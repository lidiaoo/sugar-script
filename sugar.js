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
// @priority     1000
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
            key: 'fd14f9f8e38808fa',
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        },
        playLinkApi: {
            url: 'https://quantumultx.me/',
            maxAttempts: 20,
            retryDelay: 1000,
            forceGM: true
        },
        player: {
            onlinePlayer: 'https://m3u8player.org/player.html?url=',
            vlcProtocol: 'vlc://'
        },
        targetApis: [
            {match: '/h5/system/info', handler: handleSystemInfoApi},
            {match: '/h5/movie/block', handler: handleMovieBlockApi},
            {match: '/h5/user/info', handler: handleUserInfoApi},
            {match: '/h5/movie/detail', handler: handleMovieDetailApi},
            {match: '/h5/movie/search', handler: handleMovieSearchApi},
            {match: '/h5/danmaku/list', handler: handleDanmakuApi},
        ],
        script: {
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
            const decrypted = CryptoJS.AES.decrypt(
                cipherParams,
                CryptoJS.enc.Utf8.parse(CONFIG.aes.key),
                {mode: CONFIG.aes.mode, padding: CONFIG.aes.padding}
            );
            return decrypted.toString(CryptoJS.enc.Utf8);
        } catch (e) {
            console.error(`[油猴1.0][AES解密失败] ${e.message}`);
            throw e;
        }
    }

    function aesEcbEncrypt(plainText) {
        try {
            const paddedText = CryptoJS.enc.Utf8.parse(plainText);
            const encrypted = CryptoJS.AES.encrypt(
                paddedText,
                CryptoJS.enc.Utf8.parse(CONFIG.aes.key),
                {mode: CONFIG.aes.mode, padding: CONFIG.aes.padding}
            );
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
                const responseText = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: CONFIG.playLinkApi.url,
                        anonymous: true,
                        headers: {
                            'Content-Type': 'application/json',
                            "Referer": "",
                            "Authorization": "",
                            "tx_rate_limit": "",
                        },
                        data: JSON.stringify({video_id: videoId}),
                        timeout: 2000,
                        onload: (res) => {
                            console.log(`[油猴1.0][播放链接] 第${attempt}次请求状态：${res.status}`);
                            if (res.status === 200) {
                                resolve(res.responseText);
                            } else {
                                reject(new Error(`服务器返回非200状态：${res.status}（响应：${res.responseText.slice(0, 100)}）`));
                            }
                        },
                        onerror: (err) => {
                            reject(new Error(`GM请求错误：${err.message}（可能是网络问题或服务器拒绝）`));
                        },
                        ontimeout: () => {
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
                    // alert(`获取播放链接成功 ${result.playLink}`);
                    return result.playLink;
                } else {
                    throw new Error(`无有效playLink（响应：${JSON.stringify(result, null, 2)}）`);
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
    function handleUserInfoApi(decryptedStr) {
        try {
            console.log('[油猴1.0][用户信息API] 开始处理');
            let userData = JSON.parse(decryptedStr);

            if (userData?.data?.is_vip === 'n') {
                userData.data.is_vip = 'y';
                console.log('[油猴1.0][用户信息API] VIP状态：n → y');
            }

            if (userData?.data?.is_dark_vip === 'n') {
                userData.data.is_dark_vip = 'y';
                console.log('[油猴1.0][用户信息API] dark VIP状态：n → y');
            }

            if (userData?.data?.balance !== undefined) {
                userData.data.balance = '99999999';
                userData.data.balance_income = '99999999';
                userData.data.balance_freeze = '0';
                console.log('[油猴1.0][用户信息API] 余额：已设置为99999999');
            }

            if (userData?.data?.group_end_time !== undefined) {
                userData.data.group_end_time = '2999-09-09到期';
                console.log('[油猴1.0][用户信息API] 到期时间：已设置为2999-09-09到期');
            }
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

            return JSON.stringify(userData, null, 2);
        } catch (e) {
            console.error(`[油猴1.0][用户信息API处理失败] ${e.message}`);
            return decryptedStr;
        }
    }

    function handleSystemInfoApi(decryptedStr) {
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

            return JSON.stringify(systemData, null, 2);
        } catch (e) {
            console.error(`[油猴1.0][系统信息API处理失败] ${e.message}`);
            return decryptedStr;
        }
    }

    function handleMovieBlockApi(decryptedStr) {
        try {
            console.log('[油猴1.0][系统视频信息API] 开始处理');
            let movieData = JSON.parse(decryptedStr);
            movieData = {
                ...movieData,
                data: movieData.data.map(item => ({
                    ...item,
                    ad: [] // 设为空数组
                }))
            };

            return JSON.stringify(movieData, null, 2);
        } catch (e) {
            console.error(`[油猴1.0][系统视频信息API处理失败] ${e.message}`);
            return decryptedStr;
        }
    }

    async function handleMovieDetailApi(decryptedStr) {
        try {
            console.log('[油猴1.0][电影详情API] 开始处理');
            let movieData = JSON.parse(decryptedStr);

            if (movieData?.data?.is_dark_vip === 'n') {
                movieData.data.is_dark_vip = 'y';
                console.log('[油猴1.0][电影详情API] VIP状态：n → y');
            }

            if (movieData?.data?.balance !== undefined) {
                movieData.data.balance = '99999999';
                movieData.data.balance_income = '99999999';
                movieData.data.balance_freeze = '0';
                console.log('[油猴1.0][电影详情API] 余额：已设置为99999999');
            }

            if (movieData?.data?.lines && movieData.data.lines.length >= 2) {
                const vipLine = movieData.data.lines[1];
                if (vipLine?.link) {
                    movieData.data.backup_link = vipLine.link;
                    movieData.data.play_link = vipLine.link;
                    console.log(`[油猴1.0][电影详情API] 播放线路：切换为VIP线路 → ${vipLine.link.slice(0, 50)}...`);
                }
            }

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
                const playLink = await getPlayLink(videoId);
                if (playLink) {
                    const startStr = "/h5/m3u8/link";
                    const startIndex = playLink.indexOf(startStr);
                    if (startIndex !== -1) {
                        // 从startStr开始截取到结尾（包含后续所有内容）
                        const subLink = playLink.slice(startIndex);
                        console.log(subLink);
                        // 输出: /h5/m3u8/link/567c5935bd1de50452f0d601a6ef634b.m3u8
                        movieData.data.backup_link = subLink;
                        movieData.data.play_link = subLink;
                    }
                    openPlayers(playLink);
                }
            }

            return JSON.stringify(movieData, null, 2);
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

            return JSON.stringify(movieData, null, 2);
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

            return JSON.stringify(movieData, null, 2);
        } catch (e) {
            console.error(`[油猴1.0][电影danmakuAPI处理失败] ${e.message}`);
            return decryptedStr;
        }
    }


    // ==================== 9. API路由 ====================
    async function routeApiHandler(requestUrl, decryptedStr) {
        for (const api of CONFIG.targetApis) {
            if (requestUrl.includes(api.match)) {
                console.log(`[油猴1.0][API路由] 匹配成功：${api.match} → 执行${api.handler.name}`);
                return typeof api.handler === 'async function'
                    ? await api.handler(decryptedStr)
                    : api.handler(decryptedStr);
            }
        }
        console.log(`[油猴1.0][API路由] 未匹配目标API：${requestUrl}`);
        return decryptedStr;
    }


    // ==================== 10. XHR拦截 ====================
    console.log('[油猴][XHR拦截] 启用新拦截方式（原型链重写）');

    // 保存原始open方法
    const originalOpen = XMLHttpRequest.prototype.open;

    // 重写open方法，全面捕获请求信息
    XMLHttpRequest.prototype.open = function (method, url, async = true, user = null, password = null) {
        const xhr = this; // 当前XHR实例
        const headerObj = {}; // 存储请求头
        xhr._requestHeaders = new Map(); // 保留原始请求头Map

        // 重写setRequestHeader，捕获所有请求头
        const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
        XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
            headerObj[header] = value; // 存储到对象（便于查看）
            xhr._requestHeaders.set(header, value); // 存储到Map（原始格式）
            return originalSetRequestHeader.apply(this, arguments); // 执行原始方法
        };

        // 重写send方法，处理请求数据和响应
        const originalSend = xhr.send;
        xhr.send = function (data) {
            // 1. 解析请求信息
            const urlObj = new URL(url, window.location.href);
            const requestInfo = {
                createTime: new Date(), // 请求时间
                method: method, // 请求方法
                url: urlObj.href, // 完整URL
                data: data || null, // 请求参数
                headers: {...headerObj} // 请求头
            };

            // 2. 排除不需要处理的接口
            //const isExcluded = API_CONFIG.excludeApis.some(api => url.includes(api));
            //if (!isExcluded) {
            //    requestList.push(requestInfo); // 记录请求
            //    console.log('[油猴][XHR拦截] 捕获请求：', requestInfo);
            //}

            //const isTargetApi = API_CONFIG.targetApis.some(api => url.includes(api.match));

            const isTargetApi = true
            if (isTargetApi) {
                console.log(`[油猴][XHR拦截] 匹配目标API：${url}`);

                // 重写onload事件处理响应
                const originalOnload = xhr.onload;
                xhr.onload = async function () {
                    try {
                        // 仅处理成功响应（200-299状态码）
                        if (xhr.status >= 200 && xhr.status < 300) {
                            const cipherText = xhr.responseText; // 原始加密响应
                            console.log(`[油猴][XHR处理] 原始响应长度：${cipherText.length} 字符`);

                            // 核心流程：解密→业务处理→加密
                            const decrypted = aesEcbDecrypt(cipherText);
                            const modified = await routeApiHandler(url, decrypted);
                            const encrypted = aesEcbEncrypt(modified);

                            // 重写响应数据，让页面接收修改后的值
                            Object.defineProperty(xhr, 'responseText', {
                                value: encrypted,
                                writable: false
                            });
                            // 同步修改response属性（针对responseType为text的情况）
                            if (xhr.responseType === '' || xhr.responseType === 'text') {
                                Object.defineProperty(xhr, 'response', {
                                    value: encrypted,
                                    writable: false
                                });
                            }

                            console.log(`[油猴][XHR处理完成] 已修改${url}响应`);
                        }
                    } catch (e) {
                        console.error(`[油猴][XHR处理失败] ${e.message}`, e);
                    }
                    // 执行页面原始的onload逻辑
                    if (typeof originalOnload === 'function') {
                        originalOnload.call(this);
                    }
                };

                // 重写onreadystatechange（兼容旧框架）
                const originalReadyState = xhr.onreadystatechange;
                xhr.onreadystatechange = async function () {
                    // 响应完成且未处理过
                    if (xhr.readyState === 4 && xhr.status >= 200 && xhr.status < 300 && !xhr._handled) {
                        xhr._handled = true;
                        // 响应处理逻辑与onload一致（避免重复代码）
                    }
                    // 执行页面原始的onreadystatechange逻辑
                    if (typeof originalReadyState === 'function') {
                        originalReadyState.call(this);
                    }
                };
            }

            // 4. 调用原始send方法发送请求
            originalSend.call(this, data);
        };

        // 调用原始open方法
        return originalOpen.call(this, method, url, async, user, password);
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
            const cipherText = await resClone.text();

            const decrypted = aesEcbDecrypt(cipherText);
            const modified = await routeApiHandler(requestUrl, decrypted);
            const encrypted = aesEcbEncrypt(modified);

            return new Response(encrypted, {
                status: originalRes.status,
                statusText: originalRes.statusText,
                headers: originalRes.headers
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
})();