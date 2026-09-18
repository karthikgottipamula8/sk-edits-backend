/**
 * SK EDITS — Server-Side Chat Privacy & Contact Information Guard
 * Strictly prevents Clients and Editors from exchanging private contact details.
 */

// Common prohibited phrases (case-insensitive)
const PROHIBITED_PHRASES = [
  "call me", "whatsapp me", "message me", "email me", "contact me", "dm me",
  "send me your number", "my number is", "reach me at", "text me", "ping me on whatsapp",
  "telegram me", "insta me", "instagram me", "hit me up on", "add me on", "chat on whatsapp",
  "my email is", "write to me at", "phone number"
];

// Phone number regex patterns (standard digits, spaced digits, dotted digits, symbols)
const PHONE_REGEX = /(\+?\d{1,4}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}|\b\d{10}\b|\b\d{5}[-.\s]?\d{5}\b/;

// Obfuscated phone pattern (e.g. 9 8 7 6 5 4 3 2 1 0 or 9.8.7.6.5)
const OBFUSCATED_PHONE_REGEX = /(?:\b\d[\s._-]{1,2}){9,}\d\b/;

// Spelled out number words (e.g. "nine eight seven six...")
const WORD_NUMBERS_REGEX = /\b(zero|one|two|three|four|five|six|seven|eight|nine)[\s._-]+(zero|one|two|three|four|five|six|seven|eight|nine)[\s._-]+(zero|one|two|three|four|five|six|seven|eight|nine)/i;

// Email regex pattern
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;

// Social handle patterns (@username or telegram/instagram URLs)
const SOCIAL_HANDLE_REGEX = /(?:instagram\.com\/|t\.me\/|wa\.me\/|twitter\.com\/|facebook\.com\/)[\w.]+/i;

/**
 * Validates a chat message for contact information violations.
 * @param {string} content - Message text content.
 * @param {string} senderRole - 'ADMIN', 'CLIENT', or 'EDITOR'.
 * @returns {{ isValid: boolean, reason?: string }}
 */
export function validateChatMessage(content, senderRole) {
  // Admin is exempt from filter restrictions
  if (senderRole === 'ADMIN') {
    return { isValid: true };
  }

  if (!content || typeof content !== 'string') {
    return { isValid: true };
  }

  const text = content.toLowerCase();

  // 1. Check for Prohibited Contact Phrases
  for (const phrase of PROHIBITED_PHRASES) {
    if (text.includes(phrase)) {
      return {
        isValid: false,
        reason: "For your privacy and security, sharing personal contact information is not allowed in this chat."
      };
    }
  }

  // 2. Check for Email Addresses
  if (EMAIL_REGEX.test(content)) {
    return {
      isValid: false,
      reason: "For your privacy and security, sharing email addresses is not allowed in this chat."
    };
  }

  // 3. Check for Phone Numbers & Obfuscated Numbers
  if (PHONE_REGEX.test(content) || OBFUSCATED_PHONE_REGEX.test(content) || WORD_NUMBERS_REGEX.test(content)) {
    return {
      isValid: false,
      reason: "For your privacy and security, sharing phone numbers is not allowed in this chat."
    };
  }

  // 4. Check for Direct Social Media / External Chat Links
  if (SOCIAL_HANDLE_REGEX.test(content)) {
    return {
      isValid: false,
      reason: "For your privacy and security, sharing external social media handles is not allowed in this chat."
    };
  }

  return { isValid: true };
}
