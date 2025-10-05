// ==UserScript==
// @name         禁止调试与全面拦截跳转
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  移除debugger、拦截跳转逻辑并处理noscript标签
// @author       Your Name
// @match        *://*/*
// @grant        none
// @run-at       document-start
// @priority     1000
// ==/UserScript==

(function () {
    console.log('[油猴] 拦截脚本===============================================');

    // 配置项
    const TARGET_SCRIPT_REG = /\/_nuxt\/[\w]+\.js$/;
    const JUMP_CODE = 'e&&(window.location.href="https://www.baidu.com")';
    const REPLACE_WITH = '';
    const MODIFIED_MARKER = 'data-modified-by-userscript';

    // 1. 重写createElement拦截script创建
    const originalCreateElement = document.createElement;
    document.createElement = function (tagName) {
        if (tagName.toLowerCase() === 'script') {
            const script = originalCreateElement.call(this, 'script');

            // 重写src属性
            Object.defineProperty(script, 'src', {
                get: () => script._customSrc || '',
                set: function (src) {
                    if (this.hasAttribute(MODIFIED_MARKER)) {
                        this._customSrc = src;
                        return;
                    }

                    if (TARGET_SCRIPT_REG.test(src)) {
                        this._customSrc = src;
                        console.log(`[油猴] 拦截脚本：${src}`);
                        fetchAndModifyScript(src, script);
                    } else {
                        this._customSrc = src;
                        originalSetAttribute.call(script, 'src', src);
                    }
                },
                enumerable: true
            });

            // 重写setAttribute
            const originalSetAttribute = script.setAttribute;
            script.setAttribute = function (name, value) {
                if (name.toLowerCase() === 'src' && !this.hasAttribute(MODIFIED_MARKER) && TARGET_SCRIPT_REG.test(value)) {
                    this.src = value;
                } else {
                    originalSetAttribute.call(this, name, value);
                }
            };

            return script;
        }
        return originalCreateElement.call(this, tagName);
    };

    // 2. 核心处理函数（新增父节点监听逻辑）
    function fetchAndModifyScript(originalSrc, originalScript) {
        fetch(originalSrc)
            .then(response => {
                if (!response.ok) throw new Error(`请求失败：${response.status}`);
                if (!response.headers.get('content-type')?.includes('javascript')) {
                    throw new Error('非JS响应');
                }
                return response.text();
            })
            .then(scriptText => {
                const modifiedText = scriptText.replace(JUMP_CODE, REPLACE_WITH);
                const blob = new Blob([modifiedText], {type: 'text/javascript'});
                const modifiedSrc = URL.createObjectURL(blob);

                // 创建新脚本并标记
                const newScript = originalCreateElement.call(document, 'script');
                newScript.setAttribute(MODIFIED_MARKER, 'true');

                // 继承属性
                newScript.async = originalScript.async;
                newScript.defer = originalScript.defer;
                if (originalScript.crossOrigin) newScript.crossOrigin = originalScript.crossOrigin;
                Array.from(originalScript.attributes).forEach(attr => {
                    if (attr.name !== 'src' && attr.name !== MODIFIED_MARKER) {
                        newScript.setAttribute(attr.name, attr.value);
                    }
                });

                newScript.src = modifiedSrc;
                newScript.onload = () => {
                    URL.revokeObjectURL(modifiedSrc);
                    console.log(`[油猴] 替换完成：${originalSrc}`);
                };
                newScript.onerror = (err) => {
                    URL.revokeObjectURL(modifiedSrc);
                    console.error(`[油猴] 注入失败：${originalSrc}`, err);
                };

                // 关键修复：处理原脚本无父节点的情况
                if (originalScript.parentNode) {
                    // 情况1：原脚本已有父节点，直接替换
                    originalScript.parentNode.insertBefore(newScript, originalScript);
                    originalScript.remove();
                    console.log(`[油猴] 直接替换脚本（已有父节点）：${originalSrc}`);
                } else {
                    // 情况2：原脚本暂无父节点，监听其插入DOM的时刻
                    console.log(`[油猴] 等待脚本插入DOM：${originalSrc}`);
                    const parentObserver = new MutationObserver((mutations) => {
                        // 原脚本被插入到DOM后，立即替换
                        if (originalScript.parentNode) {
                            originalScript.parentNode.insertBefore(newScript, originalScript);
                            originalScript.remove();
                            parentObserver.disconnect(); // 停止监听
                            console.log(`[油猴] 延迟替换脚本（已插入DOM）：${originalSrc}`);
                        }
                    });

                    // 监听整个文档的变化，等待原脚本被插入
                    parentObserver.observe(document.documentElement, {
                        childList: true,
                        subtree: true
                    });

                    // 超时保护：5秒后若仍未插入，则直接注入到head
                    setTimeout(() => {
                        if (!newScript.parentNode) { // 新脚本未被插入
                            parentObserver.disconnect();
                            if (document.head) {
                                document.head.appendChild(newScript);
                                console.log(`[油猴] 超时 fallback 注入：${originalSrc}`);
                            }
                        }
                    }, 5000);
                }
            })
            .catch(err => {
                console.error(`[油猴] 处理失败：${originalSrc}`, err);
            });
    }

    // 3. 修复循环的MutationObserver
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (
                    node.tagName === 'SCRIPT' &&
                    !node.hasAttribute(MODIFIED_MARKER) &&
                    TARGET_SCRIPT_REG.test(node.src)
                ) {
                    console.log(`[油猴] 兜底拦截：${node.src}`);
                    node.remove();
                    const newScript = originalCreateElement.call(document, 'script');
                    newScript.setAttribute(MODIFIED_MARKER, 'true');
                    fetchAndModifyScript(node.src, newScript);
                    if (node.parentNode) {
                        node.parentNode.insertBefore(newScript, node);
                    } else {
                        // 兜底：若原节点无父节点，直接插入head
                        if (document.head) document.head.appendChild(newScript);
                    }
                }
            });
        });
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    window.addEventListener('beforeunload', () => {
        observer.disconnect();
    });

    console.log('[油猴] 脚本启动（已修复父节点问题）');
})();