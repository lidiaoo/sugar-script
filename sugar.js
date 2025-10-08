// ==UserScript==
// @name         sugar
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  sugar
// @author       lidiaoo
// @include     *://txh*.com/*
// @connect      *
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @run-at       document-start
// @require      https://cdn.bootcdn.net/ajax/libs/crypto-js/4.2.0/crypto-js.js
// ==/UserScript==

(function () {
    'use strict';

    // ==================== 1. Crypto-JS加载检测 ====================
    if (typeof window.CryptoJS === 'undefined') {
        alert('Crypto-JS加载失败，脚本无法运行！请检查网络或重新安装脚本。');
        console.error('[油猴1.0][错误] Crypto-JS未加载：检查bootcdn访问或脚本猫外部资源权限');
        return;
    }
    const CryptoJS = window.CryptoJS;


    // ==================== 2. GM_xmlhttpRequest可用性检测（脚本猫兼容） ====================
    if (typeof GM_xmlhttpRequest === 'undefined') {
        alert('GM_xmlhttpRequest未启用！请按提示配置脚本猫权限：\n1. 打开脚本猫→当前脚本→脚本设置\n2. 权限管理→勾选"跨域请求权限"\n3. 保存后刷新页面');
        console.error('[油猴1.0][严重错误] GM_xmlhttpRequest不可用！脚本猫配置步骤：');
        console.error('1. 点击浏览器右上角脚本猫图标→进入"我的脚本"');
        console.error('2. 找到当前脚本→点击右侧"更多"→"脚本设置"');
        console.error('3. 进入"权限管理"→勾选"跨域请求权限"和"GM_xmlhttpRequest权限"');
        console.error('4. 关闭所有txh066.com标签页，重新打开');
        return;
    }
    // 替换GM_log：用console.log，脚本猫日志面板可查看
    console.log('[油猴1.0][成功] GM_xmlhttpRequest已启用，将用于解决CORS跨域');


    // ==================== 3. 禁止调试逻辑 ====================
    console.log('[油猴1.0] 脚本启动===============================================');

    // 禁用右键
    document.addEventListener('contextmenu', e => {
        e.preventDefault();
        console.log('[油猴1.0][禁止调试] 右键菜单已禁用');
    });

    // 禁用F12/快捷键
    document.addEventListener('keydown', e => {
        if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) || (e.ctrlKey && e.key === 'U')) {
            e.preventDefault();
            console.log('[油猴1.0][禁止调试] 开发者工具快捷键已禁用');
        }
    });

    // 拦截debugger
    window.debugger = () => console.log('[油猴1.0][禁止调试] debugger语句已拦截');

    // 处理noscript
    const handleNoscript = () => {
        document.querySelectorAll('noscript').forEach(tag => tag.style.display = 'none');
        console.log('[油猴1.0][处理noscript] 已隐藏noscript标签');
    };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', handleNoscript) : handleNoscript();

    // ==================== 4. 核心配置 ====================
    const CONFIG = {
        aes: {
            key: 'fd14f9f8e38808fa', mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7
        }, playLinkApi: {
            url: 'http://158.178.158.236:3988/parse', maxAttempts: 30, retryDelay: 1000, forceGM: true
        }, player: {
            onlinePlayer: 'https://m3u8player.org/player.html?url=', vlcProtocol: 'vlc://'
        }, targetApis: [{match: '/h5/system/info', handler: handleSystemInfoApi}, {
            match: '/h5/movie/block', handler: handleMovieBlockApi
        }, {match: '/h5/user/info', handler: handleUserInfoApi}, {
            match: '/h5/movie/detail', handler: handleMovieDetailApi
        }, {match: '/h5/movie/search1', handler: handleMovieSearchApi}, {
            match: '/h5/danmaku/list1', handler: handleDanmakuApi
        },], script: {
            targetReg: /\/_nuxt\/[\w]+\.js$/,
            jumpCode: 'e&&(window.location.href="https://www.baidu.com")',
            marker: 'data-userscript-handled'
        }
    };


    // ==================== 5. AES工具函数 ====================
    function aesEcbDecrypt(cipherText) {
        try {
            const cipherParams = CryptoJS.lib.CipherParams.create({
                ciphertext: CryptoJS.enc.Base64.parse(cipherText)
            });
            const decrypted = CryptoJS.AES.decrypt(cipherParams, CryptoJS.enc.Utf8.parse(CONFIG.aes.key), {
                mode: CONFIG.aes.mode, padding: CONFIG.aes.padding
            });
            return decrypted.toString(CryptoJS.enc.Utf8);
        } catch (e) {
            console.error(`[油猴1.0][AES解密失败] ${e.message}`);
            throw e;
        }
    }

    function aesEcbEncrypt(plainText) {
        try {
            const paddedText = CryptoJS.enc.Utf8.parse(plainText);
            const encrypted = CryptoJS.AES.encrypt(paddedText, CryptoJS.enc.Utf8.parse(CONFIG.aes.key), {
                mode: CONFIG.aes.mode, padding: CONFIG.aes.padding
            });
            return encrypted.toString();
        } catch (e) {
            console.error(`[油猴1.0][AES加密失败] ${e.message}`);
            throw e;
        }
    }


    // ==================== 6. 播放链接获取（脚本猫GM兼容） ====================
    async function getPlayLink(videoId) {
        console.log(`[油猴1.0][播放链接] 开始获取（videoId：${videoId}），最多重试${CONFIG.playLinkApi.maxAttempts}次`);

        for (let attempt = 1; attempt <= CONFIG.playLinkApi.maxAttempts; attempt++) {
            try {
                let responseText = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'POST', url: CONFIG.playLinkApi.url, anonymous: true, headers: {
                            'Content-Type': 'application/json', "Referer": "", "Authorization": "", "tx_rate_limit": "",
                        }, data: JSON.stringify({video_id: videoId}), timeout: 2000, onload: (res) => {
                            console.log(`[油猴1.0][播放链接] 第${attempt}次请求状态：${res.status}`);
                            if (res.status === 200) {
                                resolve(res.responseText);
                            } else {
                                reject(new Error(`服务器返回非200状态：${res.status}（响应：${res.responseText.slice(0, 100)}）`));
                            }
                        }, onerror: (err) => {
                            reject(new Error(`GM请求错误：${err.message}（可能是网络问题或服务器拒绝）`));
                        }, ontimeout: () => {
                            reject(new Error(`GM请求超时（${CONFIG.playLinkApi.url}）`));
                        }
                    });
                });

                // 解析JSON
                let result;
                try {
                    result = JSON.parse(responseText);
                } catch (parseErr) {
                    throw new Error(`响应JSON解析失败：${parseErr.message}（原始响应：${responseText.slice(0, 100)}）`);
                }

                // 校验播放链接
                if (result?.playLink && typeof result.playLink === 'string' && result.playLink.startsWith('http')) {
                    console.log(`[油猴1.0][播放链接] 第${attempt}次尝试成功：${result.playLink}`);
                    openPlayers(result.playLink);
                    // alert(`获取播放链接成功 ${result.playLink}`);
                    return result.playLink;
                } else {
                    throw new Error(`无有效playLink（响应：${JSON.stringify(result)}）`);
                }

            } catch (e) {
                console.error(`[油猴1.0][播放链接] 第${attempt}次尝试失败：${e.message}`);
                if (attempt < CONFIG.playLinkApi.maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, CONFIG.playLinkApi.retryDelay));
                }
            }
        }

        console.error(`[油猴1.0][播放链接] 已尝试${CONFIG.playLinkApi.maxAttempts}次，全部失败`);
        alert(`获取播放链接失败！请检查：1. 网络是否能访问 ${CONFIG.playLinkApi.url} 2. 刷新页面重试`);
        return null;
    }


    // ==================== 7. 播放器唤起 ====================
    function openPlayers(playLink) {
        if (!playLink) return;
        try {
            const onlinePlayerUrl = CONFIG.player.onlinePlayer + encodeURIComponent(playLink);
            // 可以添加更多参数，如是否激活新标签页
            GM_openInTab(onlinePlayerUrl, {active: true});
            console.log(`[油猴1.0][浏览器播放] 已打开浏览器播放：${onlinePlayerUrl}`);
        } catch (e) {
            console.error(`[油猴1.0][浏览器播放] 唤起浏览器播放失败：${e.message}`);
        }
        // try {
        // const vlcUrl = CONFIG.player.vlcProtocol + encodeURIComponent(playLink);
        //     // 可以添加更多参数，如是否激活新标签页
        //     GM_openInTab(vlcUrl, {active: false});
        //     console.log(`[油猴1.0][播放器] 尝试唤起VLC：${vlcUrl}（需提前关联vlc://协议）`);
        // } catch (e) {
        //     console.error(`[油猴1.0][播放器] 唤起VLC失败：${e.message}`);
        // }
    }


    // ==================== 8. API数据处理 ====================
    async function handleUserInfoApi(decryptedStr) {
        try {
            console.log('[油猴1.0][用户信息API] 开始处理');
            let userData = JSON.parse(decryptedStr);
            userData.data.is_vip = 'y';
            userData.data.is_dark_vip = 'y';
            userData.data.balance = '99999999';
            userData.data.balance_income = '99999999';
            userData.data.balance_freeze = '0';
            userData.data.group_end_time = '2999-09-09到期';
            userData.data.post_banner = [];
            userData.data.bottom_ads = [];
            userData.data.bottom_ad = {};
            userData.data.layer_ad = {};
            userData.data.layer_ads = [];
            userData.data.layer_app = [];
            userData.data.ad = {};
            userData.data.ads = [];
            userData.data.notice = '';
            userData.data.ad_auto_jump = 'n';
            userData.data.site_url = '';
            userData.data.dark_tips = '';
            //const playLink =  getPlayLink('33545');
            return JSON.stringify(userData);
        } catch (e) {
            console.error(`[油猴1.0][用户信息API处理失败] ${e.message}`);
            return decryptedStr;
        }
    }

    async function handleSystemInfoApi(decryptedStr) {
        try {
            console.log('[油猴1.0][系统信息API] 开始处理');
            let systemData = JSON.parse(decryptedStr);
            systemData.data.post_banner = [];
            systemData.data.bottom_ads = [];
            systemData.data.bottom_ad = {};
            systemData.data.layer_ad = {};
            systemData.data.layer_ads = [];
            systemData.data.layer_app = [];
            systemData.data.ad = {};
            systemData.data.ads = [];
            systemData.data.notice = '';
            systemData.data.ad_auto_jump = 'y';
            systemData.data.ad_show_time = 0;
            systemData.data.site_url = '';
            systemData.data.dark_tips = '';

            return JSON.stringify(systemData);
        } catch (e) {
            console.error(`[油猴1.0][系统信息API处理失败] ${e.message}`);
            return decryptedStr;
        }
    }

    async function handleMovieBlockApi(decryptedStr) {
        try {
            console.log('[油猴1.0][系统视频信息API] 开始处理');
            let movieData = JSON.parse(decryptedStr);
            movieData = {
                ...movieData, data: movieData.data.map(item => ({
                    ...item, ad: [] // 设为空数组
                }))
            };

            return JSON.stringify(movieData);
        } catch (e) {
            console.error(`[油猴1.0][系统视频信息API处理失败] ${e.message}`);
            return decryptedStr;
        }
    }

    async function handleMovieDetailApi(decryptedStr) {
        try {
            console.log('[油猴1.0][电影详情API] 开始处理');
            let movieData = JSON.parse(decryptedStr);
            movieData.data.balance = '99999999';
            movieData.data.balance_income = '99999999';
            movieData.data.balance_freeze = '0';
            // if (movieData?.data?.lines && movieData.data.lines.length >= 2) {
            //     const vipLine = movieData.data.lines[1];
            //     if (vipLine?.link) {
            //         movieData.data.backup_link = vipLine.link;
            //         movieData.data.play_link = vipLine.link;
            //         console.log(`[油猴1.0][电影详情API] 播放线路：切换为VIP线路 → ${vipLine.link.slice(0, 50)}...`);
            //     }
            // }

            movieData.data.ad = [];
            movieData.data.ads = [];
            movieData.data.ad_apps = [];
            movieData.data.has_buy = 'y';
            movieData.data.has_favorite = 'y';
            movieData.data.has_follow = 'y';
            movieData.data.has_love = 'y';
            movieData.data.play_ads = [];
            movieData.data.play_ad_auto_jump = 'y';
            movieData.data.play_ad_show_time = 0;

            const videoId = movieData?.data?.id;
            if (videoId) {
                const playLink = getPlayLink(videoId);
                // const playLink = '';
                // if (playLink) {
                //     const startStr = "/h5/m3u8/link";
                //     const startIndex = playLink.indexOf(startStr);
                //     if (startIndex !== -1) {
                //         // 从startStr开始截取到结尾（包含后续所有内容）
                //         const subLink = playLink.slice(startIndex);
                //         console.log(subLink);
                //         // 输出: /h5/m3u8/link/567c5935bd1de50452f0d601a6ef634b.m3u8
                //         movieData.data.backup_link = subLink;
                //         movieData.data.play_link = subLink;
                //     }
                // }
            }
            // movieData.data.backup_link = 'https://';
            // movieData.data.play_link = 'https://';
            return JSON.stringify(movieData);
        } catch (e) {
            console.error(`[油猴1.0][电影详情API处理失败] ${e.message}`);
            return decryptedStr;
        }
    }


    async function handleMovieSearchApi(decryptedStr) {
        try {
            console.log('[油猴1.0][电影搜索API] 开始处理');
            let movieData = JSON.parse(decryptedStr);

            movieData.data = movieData.data.filter(item => item.type != 'ad');

            return JSON.stringify(movieData);
        } catch (e) {
            console.error(`[油猴1.0][电影搜索API处理失败] ${e.message}`);
            return decryptedStr;
        }
    }

    async function handleDanmakuApi(decryptedStr) {
        try {
            console.log('[油猴1.0][电影danmakuAPI] 开始处理');
            let movieData = JSON.parse(decryptedStr);

            // movieData.data = [];

            return JSON.stringify(movieData);
        } catch (e) {
            console.error(`[油猴1.0][电影danmakuAPI处理失败] ${e.message}`);
            return decryptedStr;
        }
    }


    // ==================== 9. API路由 ====================
    async function routeApiHandler(requestUrl, originData) {
        let match = false
        for (const api of CONFIG.targetApis) {
            if (requestUrl.includes(api.match)) {
                try {
                    // 核心流程：解密→业务处理→加密
                    match = true
                    const decrypted = aesEcbDecrypt(originData);
                    console.log(`[油猴1.0][API路由] 匹配成功：${api.match} → 执行${api.handler.name}`);
                    let resDataStr = await api.handler(decrypted)
                    let res = aesEcbEncrypt(resDataStr);
                    const testDecrypted = aesEcbDecrypt(res);
                    return res
                } catch (e) {
                    console.error(`[油猴1.0][目标API处理出错：] ${e.message}`);
                    return originData;
                }
            }
        }
        if (!match) {
            console.log(`[油猴1.0][API路由] 未匹配目标API：${requestUrl}`);
            return originData;
        }
    }


    // ==================== 10. XHR拦截 ====================
    console.log('[油猴][XHR拦截] 启用新拦截方式（原型链重写）');
    // 保存原始 XMLHttpRequest 原型方法（避免重复重写）
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    const originalSend = XMLHttpRequest.prototype.send;

    // 1. 重写 open 方法：负责初始化请求信息 + 收集请求头（open阶段业务）
    XMLHttpRequest.prototype.open = function (method, url, async = true, user = null, password = null) {
        const xhr = this;

        // --------------------------
        // open 阶段专属业务逻辑：初始化请求元信息
        // --------------------------
        // 存储请求核心信息（供后续 send 方法使用）
        xhr._xhrMeta = {
            method: method.toUpperCase(), // 统一大写（如 GET/POST）
            url: url,                     // 原始请求URL
            isTargetApi: false,           // 是否为目标API（后续send中判断）
            handled: false                // 避免响应重复处理
        };

        // 初始化请求头容器（Map存原始格式，Object存便于查看的格式）
        xhr._requestHeaders = {
            map: new Map(),    // 原始格式（key:value，支持重复key）
            obj: {}            // 简化格式（key:value，覆盖重复key，便于打印）
        };

        // --------------------------
        // open 阶段专属业务逻辑：重写 setRequestHeader 收集请求头
        // --------------------------
        xhr.setRequestHeader = function (header, value) {
            const lowerHeader = header.toLowerCase(); // 统一header小写（避免大小写差异）

            // 1. 收集请求头到容器
            xhr._requestHeaders.map.set(lowerHeader, value); // 原始格式（保留最新值）
            xhr._requestHeaders.obj[lowerHeader] = value;    // 简化格式（覆盖重复值）

            // 2. 执行原始 setRequestHeader 方法（不破坏原生逻辑）
            return originalSetRequestHeader.apply(this, arguments);
        };

        // --------------------------
        // 执行原始 open 方法（必须调用，否则请求无法正常初始化）
        // --------------------------
        return originalOpen.call(this, method, url, async, user, password);
    };

    // 2. 重写 send 方法：负责处理请求体 + 拦截响应（send阶段业务）
    XMLHttpRequest.prototype.send = function (data) {
        const xhr = this;
        // 从 open 阶段初始化的元信息中获取数据（避免重复计算）
        const xhrMeta = xhr._xhrMeta || {};
        const requestHeaders = xhr._requestHeaders || {map: new Map(), obj: {}};

        // 仅对目标API执行后续业务逻辑（非目标API直接走原始流程）
        console.log(`[油猴][XHR拦截][${xhrMeta.method}] 匹配目标API：`, {
            url: xhrMeta.url, requestHeaders: requestHeaders.obj, // 打印收集到的请求头
            requestBodyLength: data ? (typeof data === 'string' ? data.length : '非字符串') : 0
        });

        // --------------------------
        // send 阶段专属业务逻辑：2. 统一处理响应（提取复用函数，避免重复代码）
        // --------------------------
        const handleResponse = async function () {
            // 避免重复处理（防止 onload 和 onreadystatechange 同时触发）
            if (xhrMeta.handled || xhr.status < 200 || xhr.status >= 300) {
                return;
            }
            xhrMeta.handled = true;

            try {
                // 原始加密响应（根据实际响应类型调整，如 responseText/response）
                const originResponse = xhr.responseType === '' || xhr.responseType === 'text' ? xhr.responseText : xhr.response;

                console.log(`[油猴][XHR处理][${xhrMeta.method}] 原始响应信息：`, {
                    url: xhrMeta.url,
                    status: xhr.status,
                    responseLength: originResponse ? (typeof originResponse === 'string' ? originResponse.length : '非字符串') : 0
                });

                // 调用外部API路由处理函数（用户自定义的业务逻辑）
                const modifiedResponse = await routeApiHandler(xhrMeta.url, originResponse);

                // --------------------------
                // send 阶段核心业务：重写响应数据（让页面接收修改后的值）
                // --------------------------
                // 重写 responseText（文本响应）
                Object.defineProperty(xhr, 'responseText', {
                    value: modifiedResponse, writable: false, // 禁止页面二次修改
                    configurable: true // 允许后续可能的调整
                });

                // 重写 response（兼容 responseType 为 text 或 空的情况）
                if (xhr.responseType === '' || xhr.responseType === 'text') {
                    Object.defineProperty(xhr, 'response', {
                        value: modifiedResponse, writable: false, configurable: true
                    });
                }

                console.log(`[油猴][XHR处理完成][${xhrMeta.method}] 已修改响应：`, xhrMeta.url);

            } catch (error) {
                console.error(`[油猴][XHR处理失败][${xhrMeta.method}] ${xhrMeta.url}：`, {
                    message: error.message, stack: error.stack
                });
            }
        };

        // --------------------------
        // send 阶段专属业务逻辑：3. 重写 onload（处理现代框架的响应回调）
        // --------------------------
        const originalOnload = xhr.onload;
        xhr.onload = async function (event) {
            // 先执行自定义响应处理
            await handleResponse();
            // 再执行页面原始的 onload 逻辑（不破坏页面原有功能）
            if (typeof originalOnload === 'function') {
                originalOnload.call(this, event);
            }
        };

        // --------------------------
        // send 阶段专属业务逻辑：4. 重写 onreadystatechange（兼容旧框架）
        // --------------------------
        const originalOnReadyStateChange = xhr.onreadystatechange;
        xhr.onreadystatechange = async function (event) {
            // 仅在 readyState 为 4（请求完成）时处理响应
            if (xhr.readyState === 4) {
                await handleResponse();
            }
            // 再执行页面原始的 onreadystatechange 逻辑
            if (typeof originalOnReadyStateChange === 'function') {
                originalOnReadyStateChange.call(this, event);
            }
        };

        // --------------------------
        // send 阶段可选业务逻辑：修改请求体（如加密、追加参数）
        // --------------------------
        // 示例：如果需要修改请求体，可在此处处理（如对 data 进行加密/追加字段）
        // let modifiedData = data;
        // if (xhrMeta.method === 'POST') {
        //   modifiedData = JSON.stringify({ ...JSON.parse(data), extra: 'xxx' });
        // }

        // --------------------------
        // 执行原始 send 方法（必须调用，否则请求无法发送）
        // --------------------------
        // 若有修改后的请求体，此处传 modifiedData，否则传原始 data
        return originalSend.call(this, data);
    };


    // ==================== 11. Fetch拦截 ====================
    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
        const request = input instanceof Request ? input : new Request(input, init);
        const requestUrl = request.url;

        const isTargetApi = CONFIG.targetApis.some(api => requestUrl.includes(api.match));
        if (!isTargetApi) return originalFetch.apply(this, arguments);

        console.log(`[油猴1.0][Fetch监听] 处理目标API：${requestUrl}`);
        try {
            const originalRes = await originalFetch.apply(this, arguments);
            const resClone = originalRes.clone();
            const originData = await resClone.text();

            const data = await routeApiHandler(requestUrl, originData);

            return new Response(data, {
                status: originalRes.status, statusText: originalRes.statusText, headers: originalRes.headers
            });
        } catch (e) {
            console.error(`[油猴1.0][Fetch处理失败] API：${requestUrl} → ${e.message}`);
            return originalFetch.apply(this, arguments);
        }
    };


    // ==================== 12. Script处理 ====================
    async function handleScriptNode(originalScript) {
        const scriptUrl = originalScript.src;
        if (!scriptUrl || !CONFIG.script.targetReg.test(scriptUrl)) return;

        try {
            originalScript.parentNode?.removeChild(originalScript);
            console.log(`[油猴1.0][Script处理] 移除原Nuxt脚本：${scriptUrl}`);

            const response = await fetch(scriptUrl);
            if (!response.ok) throw new Error(`脚本请求失败：${response.status}`);
            let scriptText = await response.text();

            const oldLength = scriptText.length;
            scriptText = scriptText.replace(CONFIG.script.jumpCode, '');
            if (scriptText.length < oldLength) {
                console.log(`[油猴1.0][Script处理] 已移除跳转代码：${CONFIG.script.jumpCode}`);
            }

            const newScript = document.createElement('script');
            newScript.setAttribute(CONFIG.script.marker, 'true');
            newScript.async = originalScript.async;
            newScript.defer = originalScript.defer;
            if (originalScript.crossOrigin) newScript.crossOrigin = originalScript.crossOrigin;

            const blob = new Blob([scriptText], {type: 'text/javascript'});
            newScript.src = URL.createObjectURL(blob);
            newScript.onload = () => URL.revokeObjectURL(blob);

            if (originalScript.parentNode) {
                originalScript.parentNode.insertBefore(newScript, originalScript);
            } else if (document.head) {
                document.head.appendChild(newScript);
            }
            console.log(`[油猴1.0][Script处理完成] 注入修改后脚本：${scriptUrl}`);
        } catch (e) {
            console.error(`[油猴1.0][Script处理失败] ${scriptUrl} → ${e.message}`);
        }
    }

    const scriptObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.tagName === 'SCRIPT' && CONFIG.script.targetReg.test(node.src) && !node.hasAttribute(CONFIG.script.marker)) {
                    handleScriptNode(node);
                }
            });
        });
    });
    scriptObserver.observe(document.documentElement, {childList: true, subtree: true});


    // ==================== 13. 清理与初始化日志 ====================
    window.addEventListener('beforeunload', () => {
        scriptObserver.disconnect();
        console.log('[油猴1.0][清理] 停止Script DOM监听');
    });

    console.log('[油猴1.0][初始化完成] 脚本猫兼容修复：');
    console.log('✅ 已删除GM_log（脚本猫不支持），替换为console.log');
    console.log('✅ 保留GM_xmlhttpRequest（脚本猫支持，解决CORS）');
    console.log('✅ 日志查看：脚本猫图标→"日志"面板→选择当前脚本');
    console.log('目标API：', CONFIG.targetApis.map(api => api.match).join('、'));


    // 等待 Nuxt 实例和 $axios 加载完成
    function waitForAxios() {
        const nuxtEl = document.getElementById('__nuxt');
        if (!nuxtEl || !nuxtEl.__vue__ || !nuxtEl.__vue__.$axios) {
            // 未加载完成，重试
            setTimeout(waitForAxios, 100);
            return;
        }

        const vm = nuxtEl.__vue__;
        const axiosInstance = vm.$axios;

        // 关键：拦截 $axios 内部的 request 方法（核心请求入口）
        if (axiosInstance && typeof axiosInstance.request === 'function') {
            const originalRequest = axiosInstance.request;

            // 重写 request 方法
            axiosInstance.request = function (config) {
                console.log('拦截到请求:', config);

                // 1. 修改请求参数示例
                // if (config.url.includes('/api')) {
                //     config.headers['X-Intercepted'] = 'true';
                // }

                // 2. 阻止请求示例
                // if (config.url.includes('block')) {
                //     console.log('已阻止请求:', config.url);
                //     return Promise.reject(new Error('请求被拦截'));
                // }

                // 执行原始请求
                return originalRequest.call(axiosInstance, config)
                    .then(response => {
                        console.log('拦截到响应:', response);
                        // 3. 修改响应示例
                        // response.data = { ...response.data, intercepted: true };
                        // let url = response.config.url
                        // let originData = response.data
                        // const data = routeApiHandler(url, originData);
                        // response.data = data
                        return response;
                    })
                    .catch(error => {
                        console.error('请求错误:', error);
                        return Promise.reject(error);
                    });
            };

            console.log('$axios.request 拦截器安装成功');
        } else {
            console.error('未找到 $axios.request 方法');
        }
    }

// 使用示例
    setTimeout(() => {
        const vm = document.getElementById('__nuxt');
        if (vm) {
            console.log('找到Vue实例:', vm);
            // 尝试查看数据
            console.log('实例数据:', vm.$data || vm._data);
        } else {
            console.log('未找到Vue实例');
        }
    }, 3000);
})();