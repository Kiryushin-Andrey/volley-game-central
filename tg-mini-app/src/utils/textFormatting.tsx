/**
 * Utility function to convert text with URLs and line breaks to JSX
 * - Detects URLs (http://, https://) and converts them to clickable links
 * - Preserves line breaks by converting \n to <br /> tags
 * 
 * @param text - The text to format
 * @returns JSX element with formatted text
 */
export const renderFormattedText = (text: string): JSX.Element => {
  // URL regex pattern - matches http://, https:// URLs
  const urlRegex = /(https?:\/\/[^\s\n]+)/g;
  
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let key = 0;
  
  // Find all URLs
  const urlMatches: Array<{ index: number; url: string; length: number }> = [];
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    urlMatches.push({
      index: match.index,
      url: match[0],
      length: match[0].length
    });
  }
  
  // If no URLs, just handle line breaks
  if (urlMatches.length === 0) {
    const lines = text.split('\n');
    return (
      <div className="formatted-text">
        {lines.map((line, idx) => (
          <span key={idx}>
            {line}
            {idx < lines.length - 1 && <br />}
          </span>
        ))}
      </div>
    );
  }
  
  // Process text with URLs
  urlMatches.forEach((urlMatch) => {
    // Add text before URL
    if (urlMatch.index > lastIndex) {
      const textBefore = text.substring(lastIndex, urlMatch.index);
      if (textBefore) {
        const lines = textBefore.split('\n');
        lines.forEach((line, lineIdx) => {
          if (lineIdx > 0) {
            parts.push(<br key={`br-${key++}`} />);
          }
          parts.push(line);
        });
      }
    }
    
    // Add URL as clickable link
    parts.push(
      <a
        key={`link-${key++}`}
        href={urlMatch.url}
        target="_blank"
        rel="noopener noreferrer"
        className="category-info-link"
      >
        {urlMatch.url}
      </a>
    );
    
    lastIndex = urlMatch.index + urlMatch.length;
  });
  
  // Add remaining text after last URL
  if (lastIndex < text.length) {
    const textAfter = text.substring(lastIndex);
    if (textAfter) {
      const lines = textAfter.split('\n');
      lines.forEach((line, lineIdx) => {
        if (lineIdx > 0) {
          parts.push(<br key={`br-${key++}`} />);
        }
        parts.push(line);
      });
    }
  }
  
  return <div className="formatted-text">{parts}</div>;
};

