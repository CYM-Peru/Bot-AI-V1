/**
 * WhatsApp Profile Picture Service
 * Fetches profile pictures from WhatsApp Business API
 */

interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
  baseUrl?: string;
}

interface ProfilePictureResponse {
  data?: {
    url?: string;
    id?: string;
  }[];
}

/**
 * Fetches WhatsApp profile picture URL for a phone number
 * @param config WhatsApp API configuration
 * @param phoneNumber Phone number in international format (e.g., "51987654321")
 * @returns Profile picture URL or null if not available
 */
export async function getWhatsAppProfilePicture(
  config: WhatsAppConfig,
  phoneNumber: string
): Promise<string | null> {
  try {
    const apiVersion = config.apiVersion || 'v18.0';
    const baseUrl = config.baseUrl || 'https://graph.facebook.com';

    // WhatsApp API endpoint for profile picture
    const url = `${baseUrl}/${apiVersion}/${phoneNumber}/profile_pic`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Profile picture not available or user privacy settings prevent access
      if (response.status === 404 || response.status === 403) {
        console.log(`[WhatsApp Profile] No profile picture available for ${phoneNumber}`);
        return null;
      }

      console.warn(`[WhatsApp Profile] Failed to fetch profile picture for ${phoneNumber}: ${response.status}`);
      return null;
    }

    const data: ProfilePictureResponse = await response.json();

    // Extract URL from response
    if (data.data && data.data.length > 0 && data.data[0].url) {
      const profilePicUrl = data.data[0].url;
      console.log(`[WhatsApp Profile] Found profile picture for ${phoneNumber}`);
      return profilePicUrl;
    }

    console.log(`[WhatsApp Profile] No profile picture in response for ${phoneNumber}`);
    return null;
  } catch (error) {
    console.error(`[WhatsApp Profile] Error fetching profile picture for ${phoneNumber}:`, error);
    return null;
  }
}

/**
 * Cache for profile pictures to avoid repeated API calls
 * Key: phoneNumber, Value: { url: string | null, fetchedAt: number }
 */
const profilePictureCache = new Map<string, { url: string | null; fetchedAt: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Gets profile picture with caching
 * @param config WhatsApp API configuration
 * @param phoneNumber Phone number in international format
 * @returns Profile picture URL or null
 */
export async function getCachedProfilePicture(
  config: WhatsAppConfig,
  phoneNumber: string
): Promise<string | null> {
  // Check cache
  const cached = profilePictureCache.get(phoneNumber);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.url;
  }

  // Fetch fresh data
  const url = await getWhatsAppProfilePicture(config, phoneNumber);

  // Update cache
  profilePictureCache.set(phoneNumber, {
    url,
    fetchedAt: Date.now(),
  });

  return url;
}

/**
 * Clears the profile picture cache for a specific phone number
 */
export function clearProfilePictureCache(phoneNumber: string): void {
  profilePictureCache.delete(phoneNumber);
}

/**
 * Clears all cached profile pictures
 */
export function clearAllProfilePictureCache(): void {
  profilePictureCache.clear();
}
