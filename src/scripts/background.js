!function () {
    'use strict';

    async function ResolveListener(message) {
        if (typeof message === 'object' && message.ResolveSheetBackground) {
            await MakePDF(message.ResolveSheetBackground[0], message.ResolveSheetBackground[1], message.ResolveSheetBackground[2]);
        }
    }

    async function MakePDF(SheetName, TriggerType, Pages) {
        async function GetPage(url, res, i) {
            const match = /\/score_\d+.(\w+)/.exec(url);
            const FileType = match[1];

            let DataType;

            if (FileType.toUpperCase() === 'PNG') {
                DataType = await res.arrayBuffer();
            } else if (FileType.toUpperCase() === 'SVG') {
                DataType = await res.text();
            }

            FetchedPages.push({[i]: [FileType, DataType]});

            if (FetchedPages.length === Pages.length)
                CreatePDF();
        }

        function CreatePDF() {
            const doc = new PDFDocument({
                size: [595, 842]
            });

            const stream = doc.pipe(blobStream());

            for (let i = 0; i < FetchedPages.length; i++) {
                for (let a = 0; a < FetchedPages.length; a++) {
                    if (FetchedPages[a][i]) {

                        if (FetchedPages[a][i][0].toUpperCase() === 'PNG') {
                            doc.image(FetchedPages[a][i][1], 0, 0, {fit: [595, 842]});
                        } else if (FetchedPages[a][i][0].toUpperCase() === 'SVG') {
                            SVGtoPDF(doc, FetchedPages[a][i][1], 0, 0, {preserveAspectRatio: "16:9"});
                        }

                        if (i === FetchedPages.length - 1) {
                            doc.end();

                            if (TriggerType === 'Download') {
                                const find = ['<', '>', '"', "'", '?', ':', '/', '\\', '|', '*'];

                                for (let i = 0; i < find.length; i++) {
                                    SheetName = SheetName.replace(find[i], '');
                                }

                                stream.on("finish", () => {
                                    chrome.downloads.download({
                                        filename: `${SheetName}.pdf`,
                                        url: stream.toBlobURL("application/pdf"),
                                        saveAs: true
                                    });
                                });
                            } else if (TriggerType === 'Open') {
                                //todo open sheet in new tab
                            }
                        } else {
                            doc.addPage();
                        }
                    }
                }
            }
        }

        let FetchedPages = [];

        for (let i = 0; i < Pages.length; i++) {
            fetch(Pages[i])
                .then(res => {
                    return res.ok ? res.blob() : undefined;
                })
                .then(res => GetPage(Pages[i], res, i))
                .catch(e => console.log(e));
        }
    }

    chrome.runtime.onMessage.addListener(ResolveListener);
}();
