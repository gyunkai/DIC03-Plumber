import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

type Props = {
  content: string;
};

const scrollToPdfPage = (page: number, file?: string) => {
  const iframe = document.getElementById("pdfjs-iframe") as HTMLIFrameElement;
  if (iframe && iframe.contentWindow) {
    if (file) {
      // Trigger file change and page navigation event
      const eventDetail = {
        pdfPath: file,
        page
      };

      // Dispatch event for PDF change
      window.dispatchEvent(new CustomEvent('CHANGE_PDF', {
        detail: eventDetail
      }));
    } else {
      // Jump to page only
      iframe.contentWindow.postMessage({ type: "PDF_SCROLL_TO_PAGE", page }, "*");
    }
  } else {
    console.warn("[Page Link] PDF iframe not found");
  }
};

// Parse inline:// and page:// link formats
const parseSpecialLink = (href: string | undefined) => {
  // Support for the original page:// and inline:// formats



  // Add support for https://number?file=filepath format
  if (href && href.startsWith("https://")) {
    try {
      // Parse URL
      console.log("href is", href);
      const url = new URL(href);

      // Extract page number from path (https://13 => page 13)
      const pagePathMatch = url.hostname.match(/^(\d+)$/);
      if (!pagePathMatch) {
        return null;
      }

      const pageNum = parseInt(pagePathMatch[1], 10);
      if (isNaN(pageNum)) {
        return null;
      }

      // Get file parameter
      const fileParam = url.searchParams.get('file');

      return {
        pageNum,
        fileParam
      };
    } catch (err) {
      return null;
    }
  }

  return null;
};

const MarkdownWithPageLinks: React.FC<Props> = ({ content }) => {
  // Preprocess content, convert plain text links to Markdown link format
  let processedContent = content;

  console.log("Original content:", content);

  // Match https links in parentheses: (https://number?file=filepath)
  // Modified regex to match everything from https to closing parenthesis
  const bracketLinkRegex = /\((https:\/\/\d+\?file=[^)]+)\)(?=\s|$|[:：；，,.\u3002])/g;
  console.log("bracketLinkRegex", bracketLinkRegex);
  // Use client-provided simplified method to process URLs in brackets
  console.log("Hello");
  processedContent = processedContent.replace(bracketLinkRegex, (match, url, suffix) => {
    console.log("Found bracket content:", match);
    console.log("Extracted URL:", url);

    // Ensure URL starts with https://number
    if (!url.match(/^https:\/\/\d+/)) {
      console.log("Not a PDF link format, keeping as is");
      return match;
    }

    // First encode the entire URL (encodeURI converts spaces to %20, leaves other characters unchanged)
    const safeUrl = encodeURI(url);

    // ↓↓↓ Rest of the logic remains the same, just replace url with safeUrl ↓↓↓
    const pageNumMatch = safeUrl.match(/^https:\/\/(\d+)/);
    const fileParamMatch = safeUrl.match(/file=([^&]+)/);
    const filePath = fileParamMatch ? decodeURIComponent(fileParamMatch[1]) : '';
    // Use full path instead of just filename
    const fileDisplayName = filePath || '';

    console.log("Processing result - Page:", pageNumMatch?.[1], "File path:", fileDisplayName);
    return `[PDF Page ${pageNumMatch?.[1] ?? ''}: ${fileDisplayName}](${safeUrl})${suffix}`;
  });

  console.log("Processed content:", processedContent);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        a({ href, children }) {
          console.log("Rendering link:", href);

          // Directly parse https://number?file=filepath format links
          if (href && href.startsWith("https://")) {
            try {
              console.log("Preparing to parse URL:", href);

              // Use regex to extract the number from URL
              const pageNumMatch = href.match(/^https:\/\/(\d+)/);
              console.log("Page number match result:", pageNumMatch);

              if (pageNumMatch && pageNumMatch[1]) {
                const pageNum = parseInt(pageNumMatch[1], 10);

                // Parse file parameter
                const fileParamMatch = href.match(/file=([^&]+)/);
                const fileParam = fileParamMatch ? decodeURIComponent(fileParamMatch[1]) : null;

                console.log("Regex extraction - pageNum:", pageNum);
                console.log("Regex extraction - fileParam:", fileParam);

                // Direct jump to PDF page
                return (
                  <span
                    onClick={(e) => {
                      e.preventDefault();
                      console.log("Clicked PDF link - Page:", pageNum, "File:", fileParam);
                      scrollToPdfPage(pageNum, fileParam || undefined);
                    }}
                    className="text-blue-600 underline hover:text-blue-800 cursor-pointer"
                    title={fileParam ? `Jump to ${fileParam} Page ${pageNum}` : `Jump to Page ${pageNum}`}
                  >
                    {/* Display the full file path instead of just the filename */}
                    {children && children.toString().includes(":") ? children : `PDF Page ${pageNum}: ${fileParam || ''}`}
                  </span>
                );
              }
            } catch (err) {
              console.error("Error parsing URL:", err);
            }
          }

          // Handle normal external links
          if (href) {
            return (
              <span
                onClick={(e) => {
                  e.preventDefault();
                  console.log("Clicked normal link:", href);
                  window.open(href, "_self");
                }}
                className="text-blue-600 underline hover:text-blue-800 cursor-pointer"
                title={`Open link: ${href}`}
              >
                {children}
              </span>
            );
          }

          // Case without a link, show plain text
          return <span>{children}</span>;
        },
      }}
    >
      {processedContent}
    </ReactMarkdown>
  );
};

export default MarkdownWithPageLinks;