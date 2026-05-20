import DOMPurify from 'dompurify';

/**
 * Global sanitizer for stripping malicious scripts and HTML payloads
 * from user inputs before they are processed or persisted.
 */
export const sanitizeInput = (input: unknown): unknown => {
  if (typeof input === 'string') {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [], // Strip all HTML tags by default for strict sanitization
      ALLOWED_ATTR: [], // Strip all HTML attributes
    });
  }
  
  // Preserves Dates and Firestore complex types (Timestamps, FieldValues)
  if (input instanceof Date) {
    return input;
  }

  if (input !== null && typeof input === 'object') {
    const constName = input.constructor?.name;
    if (
      constName === 'Timestamp' || 
      constName === 'FieldValue' || 
      constName === 'FieldValueImpl' || 
      ('seconds' in input && 'nanoseconds' in input)
    ) {
      return input;
    }
  }
  
  // Recursively sanitize arrays
  if (Array.isArray(input)) {
    return input.map(item => sanitizeInput(item));
  }
  
  // Recursively sanitize objects
  if (input !== null && typeof input === 'object') {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitizedObj[key] = sanitizeInput(value);
    }
    return sanitizedObj;
  }
  
  // Return primitive types (number, boolean, undefined, null) as-is
  return input;
};

/**
 * Sanitizes an HTML string, allowing safe tags.
 * Use this only when rich-text/HTML input is explicitly required and expected.
 */
export const sanitizeHtml = (htmlContent: string): string => {
  return DOMPurify.sanitize(htmlContent); // Uses DOMPurify default safe list (allows formatting tags, filters scripts)
};
