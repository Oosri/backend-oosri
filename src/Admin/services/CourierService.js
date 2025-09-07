const CourierService = require('../Model/CourierServiceModel');
const mongoDbDataFormat = require('../helper/dbHelper');
const constants = require('../constants');
const ftp = require('basic-ftp');
const { Readable } = require('stream');

module.exports = {
  createCourierService: async ({ name, fileBuffer, originalName }) => {
    const client = new ftp.Client();
    client.ftp.verbose = true;

    const uniqueFileName = `${Date.now()}-${originalName}`;
    const remoteFilePath = `/public_html/Buyer_Profile_images/${uniqueFileName}`;

    try {
      await client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        port: process.env.FTP_PORT || 21,
        secure: false,
      });

      const stream = new Readable();
      stream.push(fileBuffer);
      stream.push(null);

      await client.uploadFrom(stream, remoteFilePath);

      const imageUrl = `https://${process.env.FTP_HOST}/Courier_Service_images/${uniqueFileName}`;

      const newCourier = new CourierService({
        name,
        image: imageUrl,
      });

      const savedCourier = await newCourier.save();

      return mongoDbDataFormat.formatMongoData(savedCourier);
    } catch (error) {
      console.error('Service error: createCourierService', error);
      throw new Error(error.message);
    } finally {
      client.close();
    }
  },

  retrieveAllCourierServices: async () => {
    try {
      const couriers = await CourierService.find({});
      return couriers.map(courier => mongoDbDataFormat.formatMongoData(courier));
    } catch (error) {
      console.error('Service error: retrieveAllCourierServices', error);
      throw new Error(error.message);
    }
  }
};
