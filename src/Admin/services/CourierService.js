// services/courierService.js
const CourierService = require('../Model/CourierServiceModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const { uploadFromStream } = require('../../utils/cloudinary'); // your existing helper

module.exports = {
  /**
   * Create a new courier service with logo uploaded to Cloudinary
   * @param {{ name: string, fileBuffer: Buffer, originalName: string }} data
   */
  createCourierService: async ({ name, fileBuffer, originalName }) => {
    try {
      if (!fileBuffer || !originalName) {
        throw new Error('File buffer and original name are required');
      }

      if (!name?.trim()) {
        throw new Error('Courier service name is required');
      }

      // Sanitize and generate unique public_id
      const sanitizedName = originalName
        .replace(/[^a-zA-Z0-9.-]/g, '_')
        .substring(0, 100);

      const publicId = `couriers/${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${sanitizedName}`;

      // Upload directly to Cloudinary (streaming from buffer)
      const uploadResult = await uploadFromStream(fileBuffer, {
        folder: 'courier_services/logos',
        resourceType: 'image',
        publicId,
        transformation: [
          { width: 400, height: 400, crop: 'limit' },     // Keep aspect ratio
          { quality: 'auto:good' },
          { fetch_format: 'auto' },                       // WebP/AVIF where supported
        ],
        allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'],
        tags: ['courier', 'logo'],
        context: `name=${encodeURIComponent(name)}`,
        invalidate: true,
      });

      const imageUrl = uploadResult.secure_url;

      // Save to DB
      const newCourier = new CourierService({
        name: name.trim(),
        image: imageUrl,
        // Optional: store public_id for future deletion/updates
        cloudinaryPublicId: uploadResult.public_id,
      });

      const savedCourier = await newCourier.save();

      return mongoDbDataFormat.formatMongoData(savedCourier);
    } catch (error) {
      console.error('Service error: createCourierService', error);
      throw new Error(error.message || 'Failed to create courier service');
    }
    // No finally block needed — no FTP client to close
  },

  /**
   * Get all courier services
   */
  retrieveAllCourierServices: async () => {
    try {
      const couriers = await CourierService.find({}).lean();
      return couriers.map(courier => mongoDbDataFormat.formatMongoData(courier));
    } catch (error) {
      console.error('Service error: retrieveAllCourierServices', error);
      throw new Error('Failed to retrieve courier services');
    }
  },

  /**
   * Delete a courier service by ID
   */
  deleteCourierService: async (courierId) => {
    try {
      const courier = await CourierService.findByIdAndDelete(courierId);
      if (!courier) throw new Error('Courier service not found');
      return mongoDbDataFormat.formatMongoData(courier);
    } catch (error) {
      console.error('Service error: deleteCourierService', error);
      throw new Error(error.message || 'Failed to delete courier service');
    }
  },
}