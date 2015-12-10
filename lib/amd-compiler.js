/**
 * @file amd 模块解析和编译
 *       1）对于模块代码生成模块 id，和模块依赖信息，不对于源码的资源 id 做改写
 *       2）将这些依赖信息添加到模块文件，对于依赖信息会根据模块的配置重新计算依赖，比如配置了 map
 *          会根据 map 的定义，计算依赖再添加到模块文件依赖信息里
 * @author sparklewhy@gmail.com
 */

// 对于编译的模块，对于该模块的其他别名模块 id 也需要加上 define，这样后续 require 直接有 define 了
// 不用动态基于 path/package 计算了，这个逻辑是否有必要？
// require('er') 不存在 er/main 是否生成？ 默认会变成 er/main 的加载，虽然没有模块 id 是 er
// 是否有必要生产一个模块为 er 的代理模块？

var amdHelper = require('fisx-amd');

/**
 * 备份代码编译产生的中间代码信息，并暂时恢复正常的代码
 *
 * @inner
 * @param {string} content 文件内容
 * @param {Object} fis fis 实例
 * @return {Object}
 */
function undoFisLangCode(content, fis) {
    var reg = fis.compile.lang.reg;
    var index = 0;

    var langInfo = {};
    content = content.replace(reg, function (all) {
        var key = '__fis_backup' + index++;
        langInfo[key] = all;
        return key;
    });

    return {
        content: content,
        langInfo: langInfo
    };
}

/**
 * 恢复 FIS 生成的中间语言代码
 *
 * @inner
 * @param {string} content 代码内容
 * @param {Object} langInfo 要恢复的中间代码信息
 * @param {Object} fis fis 实例
 * @return {string}
 */
function restoreFISLangCode(content, langInfo, fis) {
    var _ = fis.util;

    if (langInfo && !_.isEmpty(langInfo)) {
        _.forEach(langInfo, function (value, key) {
            content = content.replace(key, value);
        });
    }

    return content;
}

/**
 * 规范化 require.config.shim 配置
 *
 * @inner
 * @param {Object} conf 模块配置
 * @param {Object} fis fis实例
 * @return {Object}
 */
function normalizeShimConfig(conf, fis) {
    if (!conf) {
        return;
    }

    var result = {};
    Object.keys(conf).forEach(function (moduleId) {
        var info = exports.lookup(moduleId);
        if (!info.file) {
            fis.log.warning('shim config: cannot find the shim script %s', moduleId);
            return;
        }

        var value = conf[moduleId];
        if (Array.isArray(value)) {
            result[moduleId].deps = value;
        }
        result[moduleId] = value;
    });

    return result;
}

/**
 * 添加依赖文件
 *
 * @inner
 * @param {File} file 要添加依赖信息的文件
 * @param {Object} resInfo 资源信息
 * @param {Object} options 选项
 * @param {Object} fis fis 实例
 */
function addDepFile(file, resInfo, options, fis) {
    var lookup = fis.project.lookup;
    if (resInfo && resInfo.fullPath) {
        var info = lookup(resInfo.fullPath);
        if (!info) {
            fis.log.warning('cannot find require resource file: %j', resInfo);
            return;
        }
        options.isMod && file[options.handler](info.id);
        if (info.file && info.file.isFile()) {
            file.addLink(info.file.subpath);
        }
    }
}

/**
 * 添加文件依赖信息
 *
 * @inner
 * @param {File} file 要添加依赖信息的文件
 * @param {Object} info 依赖信息
 * @param {Object} moduleConfig 模块配置
 * @param {Object} fis fis 实例
 */
function addFileDepInfo(file, info, moduleConfig, fis) {
    var moduleId = info.moduleId;
    var deps = info.deps || [];
    var isSync = info.sync;
    var handler = isSync ? 'addRequire' : 'addAsyncRequire';
    for (var i = 0, len = deps.length; i < len; i++) {
        var resInfo = amdHelper.getResourceInfo(
            deps[i], moduleId, moduleConfig, moduleConfig.map
        );
        addDepFile(
            file, resInfo.module,
            {isMod: true, handler: handler}, fis
        );
        addDepFile(
            file, resInfo.pluginResource,
            {isMod: false, handler: handler}, fis
        );
    }
}

/**
 * 解析模块代码
 *
 * @inner
 * @param {string} content 模块内容
 * @param {Object} file 模块所属的文件
 * @param {Object} moduleConfig 模块配置
 * @param {Object} fis fis 实例
 * @return {string}
 */
function parseModule(content, file, moduleConfig, fis) {
    var moduleAst = amdHelper.getAst(content);
    var moduleInfos = amdHelper.parseAMDModule(moduleAst, true);
    if (!moduleInfos) {
        return content;
    }

    var hasDefine = true;
    if (!Array.isArray(moduleInfos)) {
        hasDefine = false;
        moduleInfos = [moduleInfos];
    }

    // 初始化 模块 id
    var moduleId;
    if (hasDefine && moduleInfos.length === 1 && !moduleInfos[0].id && file.isJsLike) {
        moduleId = amdHelper.getModuleId(file.realpath, moduleConfig, true);
        moduleInfos[0].id = moduleId;
    }

    // 初始化依赖信息
    moduleInfos.forEach(function (module) {
        addFileDepInfo(
            file, {deps: module.syncDeps, sync: true, moduleId: moduleId},
            moduleConfig, fis
        );
        addFileDepInfo(
            file, {deps: module.asynDeps, moduleId: moduleId},
            moduleConfig, fis
        );
    });

    // 基于解析的依赖信息，生成模块代码
    return amdHelper.generateModuleCode(moduleInfos, moduleAst);
}

module.exports = exports = {};

/**
 * 初始化模块配置
 *
 * @param {Object} config 模块配置
 * @param {Object} fis fis 实例
 * @return {Object}
 */
exports.initModuleConfig = function (config, fis) {
    var moduleConfig = amdHelper.initModuleConfig(config, fis.project.getProjectPath());
    this.moduleConfig = moduleConfig;
    this.fis = fis;

    moduleConfig.map = amdHelper.createKVSortedIndex(moduleConfig.map || {}, true);
    moduleConfig.shim = normalizeShimConfig(moduleConfig.shim, fis);
    return moduleConfig;
};

/**
 * 查询模块文件信息
 *
 * @param {string} moduleId 要查询的模块 id
 * @param {string} ownerId 查询的模块所属的文件 id
 * @return {?Object}
 */
exports.lookup = function (moduleId, ownerId) {
    return amdHelper.lookupModuleFile(moduleId, ownerId, this.moduleConfig, this.fis);
};

/**
 * 编译 amd 模块
 *
 * @param {Object} fileInfo 要编译的文件信息
 * @param {Object} options 编译选项
 */
exports.compile = function (fileInfo, options) {
    var content = fileInfo.content;
    var file = fileInfo.file;

    if (file.ignoreAMD || options.ignore(file.id)) {
        return;
    }

    var fis = this.fis;

    // 先撤销之前编译产生的中间代码，避免影响代码解析
    var undoCodeInfo = undoFisLangCode(content, fis);

    // 解析模块代码
    var parsed = false;
    var moduleConf = this.moduleConfig;
    if (fis.util.isFunction(options.parseScript)) {
        // 由于处理的文件信息可能是 smarty 文件的嵌入脚本，因此可能直接解析代码可能会出错
        // 可以通过提供的定制解析方法，自行解析
        var parseResult = options.parseScript(undoCodeInfo.content, {
            id: file.id,
            subpath: file.subpath,
            isPartial: file.isPartial,
            isInline: file.isInline
        });
        parsed = !!parseResult;

        if (parseResult) {
            addFileDepInfo(
                file, {deps: parseResult.syncDeps, sync: true},
                moduleConf, fis
            );
            addFileDepInfo(
                file, {deps: parseResult.asynDeps},
                moduleConf, fis
            );
            parseResult.content && (content = parseResult.content);
        }
    }

    if (!parsed) {
        content = parseModule(undoCodeInfo.content, file, moduleConf, fis);
    }

    // 恢复中间代码
    fileInfo.content = restoreFISLangCode(content, undoCodeInfo.langInfo, fis);
};
