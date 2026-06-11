/**
 * @typedef {Object} HazardProperties
 * @property {string} id
 * @property {string} category
 * @property {string} severity
 * @property {string} title
 * @property {string} description
 * @property {string} status
 * @property {string} reportedAt
 */

/**
 * @typedef {Object} HazardFeature
 * @property {string} id
 * @property {number} lat
 * @property {number} lng
 * @property {HazardProperties} properties
 */

/**
 * @param {import('geojson').FeatureCollection} collection
 * @returns {HazardFeature[]}
 */
export function parseHazardFeatures(collection) {
  return collection.features
    .filter((feature) => feature.geometry?.type === 'Point')
    .map((feature) => {
      const [lng, lat] = feature.geometry.coordinates
      return {
        id: feature.properties.id,
        lat,
        lng,
        properties: feature.properties,
      }
    })
}
