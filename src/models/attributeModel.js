const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const attributeSchema = new Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            index: true
        },
        label: {
            type: String,
            required: true,
            trim: true
        },
        type: {
            type: String,
            enum: ['text', 'number', 'select', 'multiselect', 'boolean', 'date', 'object', 'rich_text'],
            required: true
        },
        options: [
            {
                type: String,
                trim: true
            }
        ], // Used for select/multiselect types
        isRequired: {
            type: Boolean,
            default: false
        },
        validation: {
            min: { type: Number },
            max: { type: Number },
            regex: { type: String }
        },
        description: {
            type: String
        }
    },
    { timestamps: true }
);

const Attribute = mongoose.model('Attribute', attributeSchema);

module.exports = { Attribute };
