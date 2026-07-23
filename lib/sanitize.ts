import sanitizeHtml from "sanitize-html";

// Sanitize API-supplied rich HTML before dangerouslySetInnerHTML. We strip source inline
// styles and style the resulting prose ourselves via the .prose class.
export function sanitize(html: string | undefined | null): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "b", "strong", "i", "em", "u", "s", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "a", "img",
      "span", "div", "table", "thead", "tbody", "tr", "td", "th", "hr",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
    },
  });
}
