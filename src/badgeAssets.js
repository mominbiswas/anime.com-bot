const BADGE_ASSET_BASE_URL = "https://animedotcom.b-cdn.net/user-badges";

export function getBadgeIconUrl(key) {
  return `${BADGE_ASSET_BASE_URL}/icon-filled/${key}.png`;
}

export function getBadgeImageUrl(key) {
  return `${BADGE_ASSET_BASE_URL}/large-filled/${key}.png`;
}
