(function () {
    console.log("[PDF Render Listener] Script injected");
  
    function notifyProgress() {
      const pdfApp = window.PDFViewerApplication;
  
      if (
        !pdfApp ||
        !pdfApp.pdfViewer ||
        !pdfApp.pdfViewer._pages ||
        pdfApp.pdfViewer._pages.length === 0
      ) {
        return setTimeout(notifyProgress, 200);
      }
  
      const total = pdfApp.pdfViewer.pagesCount;
      let current = 0;
  
      const interval = setInterval(() => {
        const visiblePages = pdfApp.pdfViewer._pages.filter(p => p.renderingState === 3); // 3 = FINISHED
        const count = visiblePages.length;
  
        if (count !== current) {
          current = count;
          window.parent.postMessage({ type: "PDF_RENDER_PROGRESS", page: current, total }, "*");
        }
  
        if (current === total) {
          window.parent.postMessage({ type: "PDF_RENDER_COMPLETE" }, "*");
          clearInterval(interval);
        }
      }, 500);
    }
  
    document.addEventListener("DOMContentLoaded", notifyProgress);
  })();
  window.parent.postMessage({ type: "PDF_RENDER_PROGRESS", page: 0, total: 1 }, "*");