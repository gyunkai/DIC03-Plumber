/**
 * PDF.js Page Listener for Quiz Generation
 * This script adds functionality to communicate with the PDF.js viewer
 * to get the current page number for quiz generation.
 */

(function () {
  console.log("[Quiz Listener] PDF page quiz listener script loaded");

  // Listen for messages from the parent window
  window.addEventListener("message", function (event) {
    // Check if the message is a request to get the current page
    if (event.data && event.data.type === "GET_CURRENT_PAGE") {
      console.log("[Quiz Listener] Received request for current page");

      try {
        // Access the PDF.js iframe
        const pdfIframe = document.getElementById("pdfjs-iframe");
        if (!pdfIframe || !pdfIframe.contentWindow) {
          console.error("[Quiz Listener] PDF.js iframe not found");
          return;
        }

        // Try to access PDF.js internals to get the current page number
        const pdfViewer = pdfIframe.contentWindow.PDFViewerApplication;
        if (!pdfViewer) {
          console.error("[Quiz Listener] PDF viewer application not available");
          return;
        }

        // Get current page and total pages
        const currentPage = pdfViewer.page;
        const totalPages = pdfViewer.pagesCount;

        console.log(
          `[Quiz Listener] Current page: ${currentPage}/${totalPages}`
        );

        // Send the current page information back to the parent window
        window.postMessage(
          {
            type: "CURRENT_PAGE_RESPONSE",
            page: currentPage,
            total: totalPages,
          },
          "*"
        );
      } catch (error) {
        console.error("[Quiz Listener] Error getting current page:", error);
      }
    }
  });

  // Listen for page change events from PDF.js
  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "PDF_PAGE_CHANGE") {
      // Store the latest page information in case it's needed later
      window._currentPdfPage = event.data.page;
      window._totalPdfPages = event.data.total;
    }
  });

  console.log("[Quiz Listener] PDF page quiz listener initialized");
})();
