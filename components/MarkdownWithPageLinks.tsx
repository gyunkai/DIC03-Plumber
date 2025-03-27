import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

type Props = {
  content: string;
};

const scrollToPdfPage = (page: number) => {
  const iframe = document.getElementById("pdfjs-iframe") as HTMLIFrameElement;
  if (iframe && iframe.contentWindow) {
    console.log(`[Page Link] Sending scroll message to PDF iframe for page ${page}`);
    // Notice we're sending `page` as the property
    iframe.contentWindow.postMessage({ type: "PDF_SCROLL_TO_PAGE", page }, "*");
  } else {
    console.warn("[Page Link] PDF iframe not found");
  }
};


const MarkdownWithPageLinks: React.FC<Props> = ({ content }) => {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        a({ href, children }) {
          if (href?.startsWith("page://")) {
            const pageNum = parseInt(href.replace("page://", ""), 10);
            return (
              <span
                onClick={(e) => {
                  e.preventDefault();
                  scrollToPdfPage(pageNum);
                }}
                className="text-blue-600 underline hover:text-blue-800 cursor-pointer"
              >
                {children}
              </span>
            );
          }

          // Regular external links
          return (
            <a
              href={href}
              className="text-blue-600 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownWithPageLinks;
