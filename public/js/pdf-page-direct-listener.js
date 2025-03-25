/**
 * PDF.js Direct Page Listener
 * A simplified approach to monitor PDF.js viewer page changes
 */

(function () {
    console.log('[Direct Listener] Script loaded at', new Date().toISOString());
    // Listen for scroll-to-page messages from parent React app
    window.addEventListener("message", (event) => {
        if (event.data && event.data.type === "PDF_SCROLL_TO_PAGE") {
        const pageNumber = event.data.page;
        if (
            typeof pageNumber === "number" &&
            window.PDFViewerApplication &&
            Number.isInteger(pageNumber)
        ) {
            console.log("[Direct Listener] Scrolling to page:", pageNumber);
            window.PDFViewerApplication.page = pageNumber;
        }
        }
    });

    
  
    // Function to check current page periodically
    function startPageCheck() {
        console.log('[Direct Listener] Starting page checking...');

        // Store last checked page to avoid sending duplicate updates
        let lastPage = null;
        let lastTotal = null;

        // Check function that will run periodically
        function checkCurrentPage() {
            try {
                const iframe = document.getElementById('pdfjs-iframe');
                if (!iframe) {
                    console.error('[Direct Listener] PDF iframe not found');
                    return;
                }

                // Try to access iframe content
                try {
                    const iframeWindow = iframe.contentWindow;

                    // Check if PDFViewerApplication exists
                    if (iframeWindow && iframeWindow.PDFViewerApplication) {
                        const pdfApp = iframeWindow.PDFViewerApplication;

                        // Get current page and total pages
                        if (pdfApp.page && pdfApp.pagesCount) {
                            const currentPage = pdfApp.page;
                            const totalPages = pdfApp.pagesCount;

                            // Only send update if page has changed
                            if (currentPage !== lastPage || totalPages !== lastTotal) {
                                console.log('[Direct Listener] Page changed:', currentPage, '/', totalPages);

                                // Update stored values
                                lastPage = currentPage;
                                lastTotal = totalPages;

                                // Get PDF name from the UI
                                const pdfNameElement = document.querySelector('.text-sm');
                                let pdfKey = 'unknown';
                                if (pdfNameElement) {
                                    pdfKey = pdfNameElement.textContent.replace('PDF: ', '');
                                }

                                // Send data to backend
                                console.log('[Direct Listener] Sending data to backend:', {
                                    pdfKey,
                                    currentPage,
                                    totalPages
                                });

                                fetch('/api/current-page', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        pdfKey,
                                        currentPage,
                                        totalPages
                                    })
                                })
                                    .then(response => {
                                        console.log('[Direct Listener] Backend response status:', response.status);
                                        return response.json();
                                    })
                                    .then(data => {
                                        console.log('[Direct Listener] Backend response:', data);
                                    })
                                    .catch(error => {
                                        console.error('[Direct Listener] Error sending to backend:', error);
                                    });

                                // Also try to highlight the current page
                                highlightCurrentPage(iframeWindow, currentPage);
                            }
                        }
                    } else {
                        console.log('[Direct Listener] PDFViewerApplication not available yet');
                    }
                } catch (error) {
                    console.error('[Direct Listener] Error accessing iframe content:', error);
                }
            } catch (error) {
                console.error('[Direct Listener] Error in checkCurrentPage:', error);
            }
        }

        // Function to highlight current page
        function highlightCurrentPage(iframeWindow, pageNumber) {
            try {
                // First try to inject styles if they don't exist
                const styleId = 'pdf-highlight-styles';
                let styleElement = iframeWindow.document.getElementById(styleId);

                if (!styleElement) {
                    styleElement = iframeWindow.document.createElement('style');
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
                    iframeWindow.document.head.appendChild(styleElement);
                    console.log('[Direct Listener] Highlight styles injected');
                }

                // Get all pages and remove highlight
                const pages = iframeWindow.document.querySelectorAll('.page');
                console.log('[Direct Listener] Found', pages.length, 'pages');

                pages.forEach(page => {
                    page.classList.remove('currentPage');
                });

                // Add highlight to current page
                if (pages.length >= pageNumber) {
                    const currentPage = pages[pageNumber - 1];
                    currentPage.classList.add('currentPage');
                    console.log('[Direct Listener] Highlighted page', pageNumber);
                }
            } catch (error) {
                console.error('[Direct Listener] Error highlighting page:', error);
            }
        }

        // Check immediately and then set up interval
        checkCurrentPage();

        // Check every 1 second
        const intervalId = setInterval(checkCurrentPage, 1000);

        // Return cleanup function
        return function cleanup() {
            clearInterval(intervalId);
            console.log('[Direct Listener] Page checking stopped');
        };
    }

    // Start checking after a short delay to ensure iframe is loaded
    setTimeout(startPageCheck, 3000);
})(); 