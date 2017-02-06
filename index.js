/**
 * @file 编译 amd 模块
 * @author sparklewhy@gmail.com
 */

var amdCompiler = require('./lib/amd-compiler');

var rScript = /<!--([\s\S]*?)(?:-->|$)|(<script[^>]*>[\s\S]*?<\/script>)/ig;
var rDataMain = /\bdata-main=('|")(.*?)\1/;

/**
 * 解析 html 的 `data-main`
 *
 * @inner
 * @param {Object} info html 文件信息
 */
function parseHTMLDataMain(info) {
    var result;
    var content = info.content;
    var script;
    var file = info.file;

    while ((result = rScript.exec(content))) {
        script = result[2];

        if (!result[1] && script && rDataMain.test(script)) {
            var moduleInfo = amdCompiler.lookup(RegExp.$2);
            if (moduleInfo.file && moduleInfo.file.isFile()) {
                file.addLink(moduleInfo.file.subpath);
            }
            file.addAsyncRequire(moduleInfo.id);
        }
    }
}

/**
 * 编译 amd 模块
 *
 * @param {Object} fis fis 实例
 * @param {Object} opts 编译选项
 */
module.exports = exports = function (fis, opts) {
    var _ = fis.util;

    // 保存 amd 模块的配置信息，方便后续处理器插件的访问处理
    opts = _.assign({}, opts || {});
    fis.config.set('amd', opts);

    // 初始化 ignore 配置项
    var ignore = opts.ignore;
    if (!_.isFunction(ignore)) {
        if (ignore && !Array.isArray(ignore)) {
            ignore = [ignore];
        }
        ignore && (ignore = ignore.map(function (item) {
            if (_.isString(item)) {
                return _.glob(item);
            }
            return item;
        }));
        opts.ignore = function (modulePath) {
            if (ignore) {
                return ignore.some(function (item) {
                    return item.test(modulePath);
                });
            }
            return false;
        };
    }

    // 初始化 模块配置
    amdCompiler.initModuleConfig(opts, fis);

    // 事件监听
    fis.on('standard:js', function (info) {
        amdCompiler.compile(info, opts);
    });
    fis.on('standard:html', parseHTMLDataMain);
};
