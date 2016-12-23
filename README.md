fisx-hook-amd
========

[![Dependency Status](https://david-dm.org/wuhy/fisx-hook-amd.svg)](https://david-dm.org/wuhy/fisx-hook-amd) [![devDependency Status](https://david-dm.org/wuhy/fisx-hook-amd/dev-status.svg)](https://david-dm.org/wuhy/fisx-hook-amd#info=devDependencies) [![NPM Version](https://img.shields.io/npm/v/fisx-hook-amd.svg?style=flat)](https://npmjs.org/package/fisx-hook-amd)

> A hook to compile amd modules for fisx.


## How to use
 
The hook is default installed by fisx.

### Add configure to `fis-conf.js`

```javasciprt
fis.hook('amd', {
    config: {
        baseUrl: 'src'
    }
});
```

### Options

* ignore - `Array|Function`: `optional` configure the files to ignore compile, the array value can be `glob` pattern or `regexp`. You also can pass a function to determin whether ignore:

    ```javascript
    {
        ignore: function (modulePath) {
            // if wanna ignore, return true
        }
    }
    
    // you can aslo using file attribute `ignoreAMD` to ignore some specified files.
    fis.match('dep/jquery/jquery.min.js', {
        ignoreAMD: true
    });
    ```
    
* config - `Object`: the AMD module `require.config` definition, by default the configuration is defined in `package.json`, so you can pass the configure like beblow:
    
    ```javascript
    {
        config: fis.getModuleConfig()
    }    
    ```
    
* parseScript - `Function`: `optional` parsing page amd modules, the option is used when the page is not standard html file, e.g., smarty template file:
   
   ```javascript
   {
        parseScript: function (content, info) {
            if (!info.isInline) {
                return;
            }
            
            // parse the inline script in page file
            return {
                asynDeps: fis.util.extractAsyncModuleIds(content)
            };
        }
   }
   ```


 

 
