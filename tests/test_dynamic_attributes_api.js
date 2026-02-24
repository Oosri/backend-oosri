const axios = require('axios');

// Using the port from .env (3001)
const BASE_URL = 'http://localhost:3001/api/v1';

const runTests = async () => {
    let testAttributeId;
    let testCategoryId;

    try {
        console.log('--- Starting Dynamic Attributes API Tests ---');

        // 1. Create a new attribute
        console.log('\n1. Creating a new attribute...');
        const attrCode = `test_attr_${Date.now()}`;
        const attributeData = {
            code: attrCode,
            label: 'Test Attribute',
            type: 'select',
            options: ['Option 1', 'Option 2', 'Option 3'],
            isRequired: true,
            description: 'A test attribute for API verification'
        };

        const attrResponse = await axios.post(`${BASE_URL}/attributes`, attributeData);
        if (attrResponse.data.success) {
            testAttributeId = attrResponse.data.data._id;
            console.log('SUCCESS: Attribute created with ID:', testAttributeId);
        } else {
            throw new Error('Failed to create attribute: ' + JSON.stringify(attrResponse.data));
        }

        // 2. Create a new category with that attribute
        console.log('\n2. Creating a new category with the attribute...');
        // Note: createCategory expecting multipart/form-data because of image upload
        // For simplicity in this test, we skip image upload if possible or use a dummy if required.
        // Looking at the controller, 'file' is required.

        // However, we want to test the GET endpoints primarily.
        // If we can't easily create a category via API without a file here, 
        // we might need to use a different approach for creation or use an existing category.

        // Let's try to find an existing category first, then update it.
        console.log('\n3. Fetching all categories to find a target...');
        const catsResponse = await axios.get(`${BASE_URL}/categories`);
        const categories = catsResponse.data.data;

        if (categories.length === 0) {
            console.log('No categories found. Skipping update test. Please ensure at least one category exists.');
        } else {
            const targetCategory = categories[0];
            const targetCategoryId = targetCategory._id;
            console.log(`Targeting category: ${targetCategory.name} (${targetCategoryId})`);

            // 4. Update category with the new attribute
            console.log('\n4. Updating category with the new attribute...');
            const updateData = {
                attributes: JSON.stringify([{
                    attributeId: testAttributeId,
                    isRequired: true,
                    isFilterable: true
                }])
            };

            const updateResponse = await axios.put(`${BASE_URL}/categories/${targetCategoryId}`, updateData);
            if (updateResponse.data.success) {
                console.log('SUCCESS: Category updated.');
            } else {
                console.error('Failed to update category:', updateResponse.data);
            }

            // 5. Verify via getCategory (singular)
            console.log('\n5. Verifying via GET /categories/:id ...');
            const getOneResponse = await axios.get(`${BASE_URL}/categories/${targetCategoryId}`);
            const categoryData = getOneResponse.data.data;

            const hasAttribute = categoryData.attributes && categoryData.attributes.some(a => a.attributeId === testAttributeId || (a.details && a.details._id === testAttributeId));

            if (hasAttribute) {
                console.log('SUCCESS: Populated attribute found in single category response.');
                console.log('Attribute Details:', JSON.stringify(categoryData.attributes.find(a => a.attributeId === testAttributeId || (a.details && a.details._id === testAttributeId)).details, null, 2));
            } else {
                console.error('FAILURE: Attribute NOT found or NOT populated in single category response.');
                console.log('Category Data received:', JSON.stringify(categoryData, null, 2));
            }

            // 6. Verify via getCategories (plural)
            console.log('\n6. Verifying via GET /categories ...');
            const getAllResponse = await axios.get(`${BASE_URL}/categories`);
            const refreshedCats = getAllResponse.data.data;
            const refreshedTarget = refreshedCats.find(c => c._id === targetCategoryId);

            const hasAttributePlural = refreshedTarget && refreshedTarget.attributes && refreshedTarget.attributes.some(a => a.attributeId === testAttributeId || (a.details && a.details._id === testAttributeId));

            if (hasAttributePlural) {
                console.log('SUCCESS: Populated attribute found in plural categories response.');
            } else {
                console.error('FAILURE: Attribute NOT found or NOT populated in plural categories response.');
            }
        }

    } catch (error) {
        console.error('Test Error:', error.response ? error.response.data : error.message);
    } finally {
        // Cleanup attribute if created
        if (testAttributeId) {
            try {
                console.log('\nCleaning up test attribute...');
                await axios.delete(`${BASE_URL}/attributes/${testAttributeId}`);
                console.log('Cleanup successful.');
            } catch (e) {
                console.error('Cleanup failed:', e.message);
            }
        }
        console.log('\n--- Tests Completed ---');
    }
};

runTests();
