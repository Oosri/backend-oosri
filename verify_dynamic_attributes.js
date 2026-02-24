const mongoose = require('mongoose');
const { Attribute } = require('./src/models/attributeModel');
const { Category } = require('./src/models/categoryModel');

require('dotenv').config();

// === COPY OF VALIDATION LOGIC FOR TESTING ===
const validateDynamicAttributes = async (attributeValues, categoryAttributes) => {
    const errors = [];

    // Create a map for quick lookup of category configuration
    const categoryAttrMap = new Map();
    categoryAttributes.forEach(attr => {
        if (attr.attributeId) {
            categoryAttrMap.set(attr.attributeId.toString(), attr);
        }
    });

    // Fetch full attribute definitions
    const attributeIds = categoryAttributes.map(a => a.attributeId);
    const fullAttributes = await Attribute.find({ _id: { $in: attributeIds } });
    const fullAttrMap = new Map();
    fullAttributes.forEach(attr => fullAttrMap.set(attr._id.toString(), attr));
    fullAttributes.forEach(attr => fullAttrMap.set(attr.code, attr));

    // 1. Check Required Attributes
    for (const [id, config] of categoryAttrMap) {
        const fullAttr = fullAttrMap.get(id);
        if (!fullAttr) continue;

        const value = attributeValues[fullAttr.code];

        if (config.isRequired && (value === undefined || value === null || value === '')) {
            errors.push(`Attribute '${fullAttr.label}' (${fullAttr.code}) is required.`);
        }
    }

    // 2. Validate Values
    for (const [code, value] of Object.entries(attributeValues)) {
        const fullAttr = fullAttrMap.get(code);

        if (!fullAttr) continue;

        const categoryConfig = categoryAttributes.find(ca =>
            ca.attributeId.toString() === fullAttr._id.toString()
        );

        if (!categoryConfig) continue;

        if (fullAttr.type === 'number') {
            if (isNaN(Number(value))) {
                errors.push(`Attribute '${fullAttr.label}' must be a number.`);
            }
        } else if (['select', 'multiselect'].includes(fullAttr.type)) {
            const validOptions = fullAttr.options || [];
            if (fullAttr.type === 'select') {
                if (!validOptions.includes(value)) {
                    errors.push(`Value '${value}' is not a valid option for '${fullAttr.label}'.`);
                }
            }
        } else if (fullAttr.type === 'object') {
            if (typeof value !== 'object' || value === null) {
                errors.push(`Attribute '${fullAttr.label}' must be a valid JSON object.`);
            }
        } else if (fullAttr.type === 'rich_text') {
            if (typeof value !== 'string') {
                errors.push(`Attribute '${fullAttr.label}' must be a string.`);
            }
        }
    }

    return errors;
};
// === END VALIDATION LOGIC ===

const runVerification = async () => {
    try {
        const dbUrl = process.env.MONGO_URI || process.env.MONGO_URI_DEV;
        if (!dbUrl) {
            console.error('MONGO_URI or MONGO_URI_DEV not found in env');
            process.exit(1);
        }
        await mongoose.connect(dbUrl);
        console.log('Connected to DB');

        // 1. Setup Data
        const attrCode = `material_${Date.now()}`;
        const attribute = new Attribute({
            code: attrCode,
            label: 'Material',
            type: 'select',
            options: ['Wood', 'Metal'],
            isRequired: true
        });
        await attribute.save();
        console.log('1. Attribute Created:', attribute.code);

        const category = new Category({
            name: `Test Category ${Date.now()}`,
            attributes: [{ attributeId: attribute._id, isRequired: true }]
        });
        await category.save();
        console.log('2. Category Created:', category.name);

        // 2. Test Case A: Missing Required Attribute
        console.log('Running Test A: Missing Required Attribute...');
        const errorsA = await validateDynamicAttributes({}, category.attributes);
        if (errorsA.length > 0 && errorsA[0].includes('is required')) {
            console.log('SUCCESS: Detected missing required attribute.');
        } else {
            console.error('FAILURE: Did not detect missing attribute', errorsA);
        }

        // 3. Test Case B: Invalid Option
        console.log('Running Test B: Invalid Option...');
        const errorsB = await validateDynamicAttributes({ [attrCode]: 'Plastic' }, category.attributes);
        if (errorsB.length > 0 && errorsB[0].includes('not a valid option')) {
            console.log('SUCCESS: Detected invalid option.');
        } else {
            console.error('FAILURE: Did not detect invalid option', errorsB);
        }

        // 4. Test Case C: Valid Input
        console.log('Running Test C: Valid Input...');
        const errorsC = await validateDynamicAttributes({ [attrCode]: 'Wood' }, category.attributes);
        if (errorsC.length === 0) {
            console.log('SUCCESS: Valid input accepted.');
        } else {
            console.error('FAILURE: Valid input rejected', errorsC);
        }

        // 5. Test Object Type
        console.log('Running Test D: Object Type...');
        const objAttrCode = `tech_specs_${Date.now()}`;
        const objAttr = new Attribute({
            code: objAttrCode,
            label: 'Tech Specs',
            type: 'object',
            isRequired: true
        });
        await objAttr.save();

        const objCat = new Category({
            name: `Test Cat Object ${Date.now()}`,
            attributes: [{ attributeId: objAttr._id, isRequired: true }]
        });
        await objCat.save();

        // Test Valid Object
        const errorsD1 = await validateDynamicAttributes({ [objAttrCode]: { cpu: "M1", ram: "16GB" } }, objCat.attributes);
        if (errorsD1.length === 0) {
            console.log('SUCCESS: Valid object accepted.');
        } else {
            console.error('FAILURE: Valid object rejected', errorsD1);
        }

        // Test Invalid Object (string)
        const errorsD2 = await validateDynamicAttributes({ [objAttrCode]: "not an object" }, objCat.attributes);
        if (errorsD2.length > 0 && errorsD2[0].includes('valid JSON object')) {
            console.log('SUCCESS: Invalid object rejected.');
        } else {
            console.error('FAILURE: Invalid object check failed', errorsD2);
        }

        // Clean up
        await Category.findByIdAndDelete(category._id);
        await Attribute.findByIdAndDelete(attribute._id);
        await Category.findByIdAndDelete(objCat._id);
        await Attribute.findByIdAndDelete(objAttr._id);
        console.log('Cleaned up test data.');

    } catch (error) {
        console.error('Verification Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

runVerification();
