const { Product, MobilePhone, Wristwatch, Tablet, ComputerAccessory } = require("../models/productModel");
const path = require('path');
const ftpClient = require('basic-ftp');




// const createProduct = async (req, res) => {
//     const client = new ftpClient.Client();
//     try {
//         const { category, ...productData } = req.body;
//         const seller = req.seller;

//         if (!seller || !seller.isVerified) {
//             return res.status(403).json({ message: "Only verified sellers can add products" });
//         }

//         let ftpDirectory;
//         switch (category) {
//             case 'mobilephone':
//                 ftpDirectory = `/public_html/product_images/mobilephones`;
//                 break;
//             case 'wristwatch':
//                 ftpDirectory = `/public_html/product_images/wristwatches`;
//                 break;
//             case 'tablet':
//                 ftpDirectory = `/public_html/product_images/tablets`;
//                 break;
//             case 'computer-accessory':
//                 ftpDirectory = `/public_html/product_images/computer-accessories`;
//                 break;
//             default:
//                 return res.status(400).json({ message: 'Invalid category' });
//         }

//         await client.access({
//             host: process.env.FTP_HOST,
//             user: process.env.FTP_USER,
//             password: process.env.FTP_PASSWORD,
//             secure: false, 
//             port: process.env.FTP_PORT || 21
//         });

//         const images = [];
//         for (const file of req.files) {
//             const uniqueFileName = `${Date.now()}-${file.originalname}`;
//             const localFilePath = file.path;
//             const remoteFilePath = `${ftpDirectory}/${uniqueFileName}`;

//             await client.uploadFrom(localFilePath, remoteFilePath);

//             const imageUrl = `https://${process.env.FTP_HOST}${remoteFilePath.replace('/public_html', '')}`;
//             images.push(imageUrl);
//         }

//         let product;
//         switch (category) {
//             case 'mobilephone':
//                 product = new MobilePhone({ ...productData, images });
//                 break;
//             case 'wristwatch':
//                 product = new Wristwatch({ ...productData, images });
//                 break;
//             case 'tablet':
//                 product = new Tablet({ ...productData, images });
//                 break;
//             case 'computer-accessory':
//                 product = new ComputerAccessory({ ...productData, images });
//                 break;
//             default:
//                 return res.status(400).json({ message: 'Invalid category' });
//         }

//         product.seller = seller._id;
//         product.isApproved = false;

//         await product.save();

//         return res.status(201).json({
//             status: 201,
//             success: true,
//             message: 'Product added successfully',
//             data: product
//         });
//     } catch (error) {
//         return res.status(500).json({
//             status: 500,
//             success: false,
//             message: 'Internal server error',
//             error: error.message
//         });
//     } finally {
//         client.close();  
//     }
// };

const createProduct = async (req, res) => {
    try {
        const { category, ...productData } = req.body;
        const seller = req.seller;

        if (!seller || !seller.isVerified) {
            return res.status(403).json({ message: "Only verified sellers can add products" });
        }

        switch (category) {
            case 'mobilephone':
                req.uploadPath = path.join(__dirname, '../../public_html/product_images/mobilephones');
                break;
            case 'wristwatch':
                req.uploadPath = path.join(__dirname, '../../public_html/product_images/wristwatches');
                break;
            case 'tablet':
                req.uploadPath = path.join(__dirname, '../../public_html/product_images/tablets');
                break;
            case 'computer-accessory':
                req.uploadPath = path.join(__dirname, '../../public_html/product_images/computer-accessories');
                break;
            default:
                return res.status(400).json({ message: 'Invalid category' });
        }

        const images = req.files.map(file => file.path);

        let product;
        switch (category) {
            case 'mobilephone':
                product = new MobilePhone({...productData, images});
                break;
            case 'wristwatch':
                product = new Wristwatch({...productData, images});
                break;
            case 'tablet':
                product = new Tablet({...productData, images});
                break;
            case 'computer-accessory':
                product = new ComputerAccessory({...productData, images});
                break;
            default:
                return res.status(400).json({ message: 'Invalid category' });
        }

        product.seller = seller._id;
        product.isApproved = false;
        await product.save();

        return res.status(201).json({ status: 201, success: true, message: 'Product added successfully', data: product });
    } catch (error) {
        return res.status(500).json({ status: 500, success: false, message: 'Internal server error', error: error.message })
    }
};

const getProducts = async (req, res) => {
    try {
        const { category } = req.query;

        let query = { isApproved: true };

        if (category) {
            query.category = category;
        }

        const products = await Product.find(query);

        return res.status(200).json({ status: 200, success: true, message: 'Successfully fetched all products', data: products });
    } catch (error) {
        return res.status(500).json({ status: 500, success: false, message: 'Internal server error', error: error.message })
    }
};

const getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findOne({ _id: id, isApproved: true });
        if (!product) {
            return res.status(404).json({ message: 'Product not found or not approved' });
        }

        return res.status(200).json({ status: 200, success: true, message: 'Product fetched successfully', data: product });
    } catch (error) {
        return res.status(500).json({ status: 500, success: false, message: 'Internal server error', error: error.message });
    }
};

const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const seller = req.seller;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.seller.toString() !== seller._id.toString()) {
            return res.status(403).json({ message: 'You can only update your own products' });
        }

        Object.assign(product, req.body);
        await product.save();

        return res.status(200).json({ status: 200, success: true, message: 'Product updated successfully', data: product });
    } catch (error) {
        return res.status(500).json({ status: 500, success: false, message: 'Internal server error', error: error.message })
    }
};

const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const seller = req.seller;

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.seller.toString() !== seller._id.toString()) {
            return res.status(403).json({ message: 'You can only delete your own products' });
        }

        await product.remove();

        return res.status(200).json({ status: 200, success: true, message: 'Product deleted successfully' });
    } catch (error) {
        return res.status(500).json({ status: 500, success: false, message: 'Internal server error', error: error.message })
    }
};


const approveProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const { action } = req.body;  // "approve" or "reject"

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        if (action === 'approve') {
            product.isApproved = true;
            await product.save();
            return res.status(200).json({ message: "Product approved successfully", product });
        } else if (action === 'reject') {
            await product.remove();
            return res.status(200).json({ message: "Product rejected and removed" });
        } else {
            return res.status(400).json({ message: "Invalid action" });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};



module.exports = {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    approveProduct
}