!function () {
    'use strict';

    const resolveListener = async message => {
        if (typeof message === 'object' && message.MDBack) {
            let mess = message.MDBack;

            if (mess.scanType && mess.scanType === 'alpha') {
                await processAlpha(mess.type, mess.trigger, mess.url);
            } else if (mess.scanType && mess.scanType === 'legacy') {
                let sheetUrl = extractSheetURL(mess.scoreUrl);

                switch (mess.type) {
                    case 'audio':
                        return processAudioLegacy(mess.name, sheetUrl, mess.trigger);
                    case 'midi':
                        return processMidiLegacy(mess.name, sheetUrl, mess.trigger);
                    case 'sheet':
                        return processSheetLegacy(mess.name, sheetUrl, mess.trigger);
                }
            }
        }
    };

    const extractSheetURL = url => {
        let match = /^https?:\/\/musescore\.com((\/[\w_-]+){1,5})/.exec(url);

        return match !== null ? match[1] : undefined;
    };

    const downloadMedia = (name, url, ext) => {
        const a = document.createElement('a');

        a.download = `${name}.${ext}`;
        a.href = url;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const getMediaUrl = async (intel, index, type, token) => {
        let url = `https://musescore.com/api/jmuse?id=${intel.idShort}&index=${index}&type=${type}&v2=1`;
        let headers = {
            referrer: intel.url,
            headers: {
                'authorization': token
            }
        };

        try {
            let res = await fetch(url, headers);
            let json = await res.json();

            return json.info.url;
        } catch (e) {
        }
    };

    const isMediaUrlValid = async url => {
        try {
            return (await fetch(url)).ok;
        } catch (e) {
            return false;
        }
    };

    const getMedia = async (intel, type) => {
        let index = type === 'img' ? 0 : 1;
        let output = {};
        let theToken;

        for (let i = 0; i < scoresLog.tokens.length; i++) {
            let mediaUrl = await getMediaUrl(intel, index, type, scoresLog.tokens[i]);

            if (mediaUrl === undefined)
                continue;

            if (type !== 'img')
                return {0: mediaUrl};

            theToken = scoresLog.tokens[i];
            break;
        }

        while (true) {
            let mediaUrl = await getMediaUrl(intel, index, type, theToken);
            let isValid = await isMediaUrlValid(mediaUrl);

            if (isValid) {
                output[index] = mediaUrl;
                index++;
            } else {
                return output;
            }
        }
    };

    const setAllTokens = async runtimeUrl => {
        let allTokens = [];

        let runtime = await fetch(runtimeUrl);

        if (runtime.ok) {
            let text = await runtime.text();

            let match = text.matchAll(/(\d+):["'](\w+)["']/g);
            let matchYearCode = text.match(/=>["'](\d+\/)["']/)[1];

            for (const mat of match) {
                let link = `https://musescore.com/static/public/build/musescore_es6/${matchYearCode}${mat[1]}.${mat[2]}.js`;

                let script = await fetch(link);

                if (script.ok) {
                    let text = await script.text();

                    let matches = text.matchAll(/["']([a-z0-9]{40})["']\)\.then/g);

                    for (const match of matches)
                        allTokens.push(match[1]);
                }

                allTokens = [...new Set(allTokens)];

                if (allTokens.length === 3)
                    break;
            }
        }

        scoresLog.tokens = allTokens;
    };

    const callMain = (type, message = undefined) => {
        const mess = {
            MDMain: {
                type: type,
                message: message
            }
        };

        browser.runtime.sendMessage(mess);
    };

    const callContent = (tabbId, type, trigger) => {
        const mess = {
            MDContent: {
                type: type,
                trigger: trigger
            }
        };

        browser.tabs.sendMessage(tabbId, mess);
    };

    const getIntelFromUrl = async url => {
        const trimSheetName = name => {
            name = name.toLowerCase();
            const find = ['<', '>', '"', "'", '“', '”', '?', ':', '/', '\\', '|', '*', ','];

            for (let i = 0; i < find.length; i++) {
                name = name.replace(find[i], '');
            }

            name = name.replaceAll(' ', '_');
            name = name.replaceAll('+', '_');

            return name.trim() === '' ? 'no_name' : name.trim();
        };

        let match = /^https?:\/\/musescore\.com((?:\/[\w_-]+){1,5})/.exec(url);

        if (match !== null) {
            let page = await fetch(url);

            if (page.ok) {
                let text = await page.text();

                let matchIdShort = /https?:\/\/musescore\.com\/user\/\d+\/scores\/(\d+)/.exec(text);

                if (matchIdShort !== null) {
                    let matchIdLong = /content="https:\/\/musescore\.com\/static\/musescore\/scoredata\/g\/(\w+)\/score_0\.\w{3}@/.exec(text);
                    let matchRuntime = /(https:\/\/musescore\.com\/static\/public\/build\/musescore_es6\/ms~runtime.\w+\.js)/.exec(text);
                    let matchName1 = /<meta[a-zA-Z="' -]*(?:property=["']og:title["'][a-zA-Z="' -]*content=["']([\S\s]+)["']|content=["']([\S\s]+)["'][a-zA-Z="' -]*property=["']og:title["'])[a-zA-Z="'\/ :-]*>/.exec(text);
                    let matchName2 = /&quot;title&quot;:&quot;(\S+)&quot;,&quot;isShowSecretUrl&quot/.exec(text);

                    let sheetName;

                    if (matchIdLong !== null && matchRuntime !== null) {
                        if (matchName2 !== null) {
                            sheetName = trimSheetName(matchName2[1]);
                        } else if (matchName1 !== null) {
                            sheetName = matchName1[1] ? trimSheetName(matchName1[1]) : trimSheetName(matchName1[2]);
                        }

                        return {
                            name: sheetName,
                            idShort: matchIdShort[1],
                            idLong: matchIdLong[1],
                            runtimeUrl: matchRuntime[1]
                        };
                    }
                }
            }
        }
    };

    const processAlpha = async (type, trigger, tab, lastChange = false) => {
        let intel = await getIntelFromUrl(tab.url);

        if (intel !== undefined) {
            if (scoresLog.tokens === undefined) {
                await setAllTokens(intel.runtimeUrl);
            }

            let mediaUrl, ext;

            if (type === 'audio') {
                mediaUrl = await getMedia(intel, 'mp3');
                ext = 'mp3';
            } else if (type === 'sheet') {
                mediaUrl = await getMedia(intel, 'img');
                ext = 'pdf';
            } else if (type === 'midi') {
                mediaUrl = await getMedia(intel, 'midi');
                ext = 'mid';
            } else {
                return callContent(tab.id, type, trigger);
            }

            if (mediaUrl === {}) {
                if (!lastChange) {
                    await setAllTokens(intel.runtimeUrl);

                    return processAlpha(type, trigger, tab.url, true);
                } else {
                    return callContent(tab.id, type, trigger);
                }
            }

            if (type !== 'sheet' && trigger === 'download') {
                downloadMedia(intel.name, mediaUrl[0], ext);
            } else if (type === 'sheet') {
                let pdf = await createPDF(mediaUrl, intel.name);

                if (!pdf)
                    return callContent(tab.id, type, trigger);

                let triggered = pdf.on('finish', async () => {
                    let url = pdf.toBlobURL('application/pdf');

                    if (trigger === 'download') {
                        downloadMedia(intel.name, url, 'pdf');

                        return true;
                    } else if (trigger === 'open') {
                        await browser.tabs.create({url: url});

                        return true;
                    }
                });

                if (!triggered)
                    return callContent(tab.id, type, trigger);
            }
        } else {
            return callContent(tab.id, type, trigger);
        }

        callMain('success');
    };

    const fetchPages = async urls => {
        let fetchedPages = {}, type;

        for (const url in urls) {
            try {
                let res = await fetch(urls[url]);

                if (res.ok) {
                    let page = await res.blob();

                    if (!type)
                        type = page.type;

                    if (type === 'image/png') {
                        fetchedPages[url] = await page.arrayBuffer();
                    } else if (type === 'image/svg+xml') {
                        fetchedPages[url] = await page.text();
                    } else {
                        return;
                    }
                }
            } catch (e) {
                return;
            }
        }

        return [fetchedPages, type];
    };

    const objectToArray = object => {
        let array = [];

        for (const obj in object)
            array.push(object[obj]);

        return array;
    };

    const createPDF = async (urls, name) => {
        let fetchedPages = await fetchPages(urls);

        if (fetchedPages === undefined)
            return;

        return generatePDF(objectToArray(fetchedPages[0]), fetchedPages[1], name);
    };

    const generatePDF = (blobs, type, name) => {
        const a4Size = [595, 842];

        const doc = new PDFDocument({
            size: a4Size
        });

        doc.info.Title = name;

        const stream = doc.pipe(blobStream());

        for (let i = 0; i < blobs.length; i++) {
            if (type === 'image/png') {
                doc.image(blobs[i], 0, 0, {fit: a4Size});
            } else if (type === 'image/svg+xml') {
                SVGtoPDF(doc, blobs[i], 0, 0, {preserveAspectRatio: '16:9'});
            }

            if (i + 1 === blobs.length) {
                doc.end();

                return stream;
            } else {
                doc.addPage();
            }
        }
    };

    /** Legacy part */

    const processAudioLegacy = (name, sheetUrl, trigger) => {
        let url = scoresLog[sheetUrl].audio;

        const ext = url.match(/^https:\/\/s3\.ultimate-guitar\.com\/musescore\.scoredata\/g\/\w+\/score\.(\w+)\?/);

        if (trigger === 'download') {
            downloadMedia(name, url, ext ? ext[1] : 'mp3');
            callMain('success');
        }
    };

    const processMidiLegacy = (name, sheetUrl, trigger) => {
        let url = scoresLog[sheetUrl].midi;

        const ext = url.match(/^https:\/\/s3\.ultimate-guitar\.com\/musescore\.scoredata\/g\/\w+\/score\.(\w+)\?/);

        if (trigger === 'download') {
            downloadMedia(name, url, ext ? ext[1] : 'mid');
            callMain('success');
        }
    };

    const processSheetLegacy = async (sheetName, sheetUrl, triggerType) => {
        const getFirstSite = site => {
            let fSite = site.match(/^(https?:\/\/s3\.ultimate-guitar\.com\/musescore\.scoredata\/g\/\w+\/score_)\d+(\.(png|svg))/);

            return fSite !== null ? `${fSite[1]}0${fSite[2]}` : undefined;
        };

        const getPage = async (res, i) => {
            let dataType;

            if (res.type === 'image/png') {
                dataType = await res.arrayBuffer();
            } else if (res.type === 'image/svg+xml') {
                dataType = await res.text();
            }

            fetchedPages.push({[i]: [res.type, dataType]});

            if (fetchedPages.length === pages.length)
                await createPDF();
        };

        const createPDF = async () => {
            const a4Size = [595, 842];

            const doc = new PDFDocument({
                size: a4Size
            });

            const stream = doc.pipe(blobStream());

            doc.info.Title = sheetName;

            for (let i = 0; i < fetchedPages.length; i++) {
                for (let a = 0; a < fetchedPages.length; a++) {
                    if (fetchedPages[a][i]) {

                        if (fetchedPages[a][i][0] === 'image/png') {
                            console.log('a');
                            doc.image(fetchedPages[a][i][1], 0, 0, {fit: a4Size});
                        } else if (fetchedPages[a][i][0] === 'image/svg+xml') {
                            console.log('b');
                            SVGtoPDF(doc, fetchedPages[a][i][1], 0, 0, {preserveAspectRatio: "16:9"});
                        }

                        if (i === fetchedPages.length - 1) {
                            doc.end();

                            stream.on('finish', async () => {
                                const url = stream.toBlobURL('application/pdf');

                                if (triggerType === 'download') {
                                    downloadMedia(sheetName, url, 'pdf');
                                } else if (triggerType === 'open') {
                                    await browser.tabs.create({url: url});
                                }

                                callMain('success');
                            });
                        } else {
                            doc.addPage();
                        }
                    }
                }
            }
        };

        let pages = scoresLog[sheetUrl].sheet;
        let fetchedPages = [];

        if (pages.length === 0) return;

        let firstSite = getFirstSite(pages[0]);

        if (firstSite) {
            if (!pages.find(el => el === firstSite))
                pages.push(firstSite);
        }

        pages.sort();

        for (let i = 0; i < pages.length; i++) {
            let res = await fetch(pages[i]);

            if (res.ok)
                await getPage(await res.blob(), i);
        }
    };

    /** Legacy logging part */

    const logScores = async details => {
        const setURLToLog = details => {
            if (details.type !== 'main_frame')
                return false;

            let sheetURL = extractSheetURL(details.url);

            if (sheetURL && !scoresLog[sheetURL]) {
                scoresLog[sheetURL] = {
                    audio: '',
                    midi: '',
                    sheet: []
                };

                return sheetURL;
            }

            return false;
        };

        const setScoreElements = url => {
            let scoreId = url.match(/^https?:\/\/s3\.ultimate-guitar\.com\/musescore\.scoredata\/g\/(\w+)\/score(?:(?<sheet>_\d+)|(?<midi>\.midi?)|(?<audio>\.mp3|\.wav|\.ogg|\.flac))/);

            if (scoreId !== null) {
                for (const score of Object.values(scoresLog)) {
                    if (score.id === scoreId[1]) {
                        let groups = scoreId.groups;

                        let type = groups.audio ? 'audio' : groups.midi ? 'midi' : groups.sheet ? 'sheet' : undefined;

                        switch (type) {
                            case 'audio':
                                return score.audio = url;
                            case 'midi':
                                return score.midi = url;
                            case 'sheet':
                                let reducedSites = score.sheet.filter(el => !el.startsWith(url));
                                reducedSites.push(url);

                                return score.sheet = reducedSites;
                        }
                    }
                }
            }
        };

        const setScoreId = async (url, scorePath) => {
            let res = await fetch(url);

            if (res.ok) {
                let text = await res.text();

                let matchScoreId = /https:\/\/musescore\.com\/static\/musescore\/scoredata\/g\/(\w+)\/score_0\.\w{3}@/.exec(text);

                if (matchScoreId !== null)
                    scoresLog[scorePath].id = matchScoreId[1];
            }
        };


        let isItScoreUrl = setURLToLog(details);

        if (!isItScoreUrl) {
            setScoreElements(details.url);
        } else if (typeof isItScoreUrl === 'string') {
            await setScoreId(details.url, isItScoreUrl);
        }
    };

    let scoresLog = {};

    browser.runtime.onMessage.addListener(resolveListener);
    browser.webRequest.onBeforeRequest.addListener(logScores, {urls: ['https://s3.ultimate-guitar.com/musescore.scoredata/g/*/score*', 'https://musescore.com/*/*']});
}();
