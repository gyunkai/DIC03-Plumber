/**
 * PDF.js Direct Page Listener
 * 此脚本必须在PDF.js iframe内部运行
 */

(function () {
    console.log("[PDF内部] 页面监听脚本已加载", new Date().toISOString());

    // 全局变量记录上次页码
    let lastPage = null;
    let lastTotal = null;

    // 高亮当前页面的函数
    function highlightCurrentPage(pageNumber) {
        try {
            // 首先尝试注入样式，如果样式不存在
            const styleId = 'pdf-highlight-styles';
            let styleElement = document.getElementById(styleId);

            if (!styleElement) {
                styleElement = document.createElement('style');
                styleElement.id = styleId;
                styleElement.textContent = `
                    .page.currentPage {
                        box-shadow: 0 0 15px 5px rgba(255, 0, 0, 0.7) !important;
                        border: 4px solid #ff0000 !important;
                        z-index: 100 !important;
                        transform: scale(1.02) !important;
                        transition: all 0.3s ease !important;
                        position: relative !important;
                    }
                `;
                document.head.appendChild(styleElement);
                console.log('[PDF内部] 高亮样式已注入');
            }

            // 获取所有页面并移除高亮
            const pages = document.querySelectorAll('.page');
            console.log('[PDF内部] 找到', pages.length, '页');

            pages.forEach(page => {
                page.classList.remove('currentPage');
            });

            // 为当前页面添加高亮
            if (pages.length >= pageNumber) {
                const currentPage = pages[pageNumber - 1];
                currentPage.classList.add('currentPage');
                console.log('[PDF内部] 已高亮页面', pageNumber);
            }
        } catch (error) {
            console.error('[PDF内部] 高亮页面时出错:', error);
        }
    }

    // 处理从父窗口接收的消息
    function handleMessage(event) {
        console.log("[PDF内部] 收到消息:", event.data);

        // 处理页面跳转消息
        if (event.data && event.data.type === "PDF_SCROLL_TO_PAGE") {
            const targetPage = event.data.page;

            if (typeof PDFViewerApplication !== 'undefined' &&
                PDFViewerApplication.pdfViewer &&
                targetPage && !isNaN(targetPage)) {

                console.log(`[PDF内部] 收到跳转到页面 ${targetPage} 命令`);

                try {
                    // 尝试使用 scrollPageIntoView 方法
                    PDFViewerApplication.pdfViewer.scrollPageIntoView({
                        pageNumber: targetPage
                    });
                    // 也可以直接设置页码，scrollPageIntoView 通常更好
                    // PDFViewerApplication.pdfViewer.currentPageNumber = targetPage; 
                    console.log(`[PDF内部] 已尝试滚动到页面: ${targetPage}`);

                    // 高亮当前页面
                    highlightCurrentPage(targetPage);
                } catch (e) {
                    console.error("[PDF内部] 跳转/滚动页面时出错:", e);
                }
            } else {
                console.warn(`[PDF内部] PDF应用未就绪或目标页面无效，无法跳转到页面 ${targetPage}`);
            }
        }
    }

    // 设置消息事件监听器
    window.addEventListener("message", handleMessage);

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

            // 高亮初始页面
            highlightCurrentPage(currentPage);

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

                // 高亮新页面
                highlightCurrentPage(newPage);
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

                            // 高亮当前页面
                            highlightCurrentPage(currentPage);
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