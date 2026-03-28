const { Attribute } = require('../models/attributeModel');

const createAttribute = async (req, res) => {
    try {
        const { code, label, type, options, validation, description, isRequired } = req.body;

        // Basic validation
        if (['select', 'multiselect'].includes(type) && (!options || options.length === 0)) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Options are required for select/multiselect types'
            });
        }

        const existingAttribute = await Attribute.findOne({ code });
        if (existingAttribute) {
            return res.status(409).json({
                status: 409,
                success: false,
                message: 'Attribute with this code already exists'
            });
        }

        const newAttribute = new Attribute({
            code,
            label,
            type,
            options,
            validation,
            description,
            isRequired
        });

        await newAttribute.save();

        return res.status(201).json({
            status: 201,
            success: true,
            message: 'Attribute created successfully',
            data: newAttribute
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const getAttributes = async (req, res) => {
    try {
        const { type } = req.query;
        const filter = {};
        if (type) {
            filter.type = type;
        }

        const attributes = await Attribute.find(filter).sort({ createdAt: -1 });

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Attributes fetched successfully',
            data: attributes
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const getAttribute = async (req, res) => {
    try {
        const { id } = req.params;
        const attribute = await Attribute.findById(id);

        if (!attribute) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Attribute not found'
            });
        }

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Attribute fetched successfully',
            data: attribute
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const updateAttribute = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Prevent updating code to duplicate
        if (updateData.code) {
            const existing = await Attribute.findOne({ code: updateData.code, _id: { $ne: id } });
            if (existing) {
                return res.status(409).json({
                    status: 409,
                    success: false,
                    message: 'Attribute code already in use'
                });
            }
        }

        const attribute = await Attribute.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });

        if (!attribute) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Attribute not found'
            });
        }

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Attribute updated successfully',
            data: attribute
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

const deleteAttribute = async (req, res) => {
    try {
        const { id } = req.params;
        const attribute = await Attribute.findByIdAndDelete(id);

        if (!attribute) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Attribute not found'
            });
        }

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Attribute deleted successfully'
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    createAttribute,
    getAttributes,
    getAttribute,
    updateAttribute,
    deleteAttribute
};
