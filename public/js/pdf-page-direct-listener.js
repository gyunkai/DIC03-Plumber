/**
 * PDF.js Direct Page Listener
 * 此脚本必须在PDF.js iframe内部运行
 */

(function () {
    console.log("[PDF内部] 页面监听脚本已加载", new Date().toISOString());

    // 全局变量记录上次页码
    let lastPage = null;
    let lastTotal = null;

    // 等待PDFViewerApplication加载完成
    function waitForPDFApplication() {
        // 检查PDF.js应用对象是否已加载
        if (typeof PDFViewerApplication === 'undefined' ||
            !PDFViewerApplication.pdfViewer ||
            !PDFViewerApplication.pdfViewer.currentPageNumber) {

            console.log("[PDF内部] 等待PDF应用加载完成...");
            setTimeout(waitForPDFApplication, 500);
            return;
        }

        console.log("[PDF内部] PDF应用已加载完成!");

        try {
            // 获取当前页码和总页数
            const currentPage = PDFViewerApplication.pdfViewer.currentPageNumber;
            const totalPages = PDFViewerApplication.pagesCount;

            console.log("[PDF内部] 初始页码:", currentPage, "/", totalPages);

            // 发送初始页码到父窗口
            window.parent.postMessage({
                type: "PDF_PAGE_CHANGE",
                page: currentPage,
                total: totalPages
            }, "*");

            // 监听页面变化事件
            PDFViewerApplication.eventBus.on("pagechanging", function (evt) {
                const newPage = evt.pageNumber;
                console.log("[PDF内部] 页面变化:", newPage, "/", totalPages);

                // 向父窗口发送页面变化消息
                window.parent.postMessage({
                    type: "PDF_PAGE_CHANGE",
                    page: newPage,
                    total: totalPages
                }, "*");
            });

            // 设置周期性检查，以防事件监听器不触发
            setInterval(function () {
                try {
                    if (typeof PDFViewerApplication !== 'undefined' &&
                        PDFViewerApplication.pdfViewer) {

                        const currentPage = PDFViewerApplication.pdfViewer.currentPageNumber;
                        const totalPages = PDFViewerApplication.pagesCount;

                        // 仅在页码变化时发送消息
                        if (currentPage !== lastPage || totalPages !== lastTotal) {
                            lastPage = currentPage;
                            lastTotal = totalPages;

                            console.log("[PDF内部] 轮询检测到页面变化:", currentPage, "/", totalPages);

                            window.parent.postMessage({
                                type: "PDF_PAGE_CHANGE",
                                page: currentPage,
                                total: totalPages
                            }, "*");
                        }
                    }
                } catch (e) {
                    console.error("[PDF内部] 轮询检查页码时出错:", e);
                }
            }, 1000);

        } catch (e) {
            console.error("[PDF内部] 设置页面监听器时出错:", e);
        }
    }

    // 启动监听过程
    waitForPDFApplication();
})(); 