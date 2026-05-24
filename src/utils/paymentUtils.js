const { Product } = require("../models/productModel");

/**
 * Validate stock availability before creating payment intent
 */
async function validateStockAvailability(sellers) {
    const stockIssues = [];

    // Step 1: Collect all unique product IDs from all sellers
    const productIds = new Set();
    const itemsByProductId = new Map();

    for (const seller of sellers) {
        for (const item of seller.items) {
            productIds.add(item.productId);

            // Store item details for validation later
            // This allows us to check if multiple sellers are selling the same product
            if (!itemsByProductId.has(item.productId)) {
                itemsByProductId.set(item.productId, []);
            }
            itemsByProductId.get(item.productId).push({
                ...item,
                sellerId: seller.sellerId
            });
        }
    }

    // Early return if no products to validate
    if (productIds.size === 0) {
        return stockIssues;
    }

    // Step 2: Fetch ALL products in a SINGLE database query
    const products = await Product.find({
        _id: { $in: Array.from(productIds) }
    }).lean();

    // Step 3: Create a Map for O(1) lookup by productId
    const productMap = new Map(
        products.map(product => [product._id.toString(), product])
    );

    // Step 4: Validate all items using the Map (O(1) lookup per item)
    for (const [productId, items] of itemsByProductId.entries()) {
        const product = productMap.get(productId);

        // Validation 1: Check if product exists in database
        if (!product) {
            for (const item of items) {
                stockIssues.push({
                    productId: item.productId,
                    productName: item.name,
                    sellerId: item.sellerId,
                    availableStock: 0,
                    issue: 'Product not found',
                    issueType: 'NOT_FOUND'
                });
            }
            continue;
        }

        // Calculate total quantity requested across all sellers for this product
        // This handles the case where multiple sellers in the cart sell the same product
        const totalQuantityRequested = items.reduce((sum, item) => sum + Number(item.quantity || 1), 0);

        // Validation 2: Check stock availability (treat missing inStock as 0)
        const availableStock = product.inStock ?? 0;
        if (availableStock < totalQuantityRequested) {
            // If multiple sellers are trying to sell the same product,
            // report the issue for each seller's order
            for (const item of items) {
                const itemQuantity = Number(item.quantity || 1);
                stockIssues.push({
                    productId: item.productId,
                    productName: item.name || product.productName,
                    sellerId: item.sellerId,
                    requestedQuantity: itemQuantity,
                    totalRequested: totalQuantityRequested,
                    availableStock,
                    issue: totalQuantityRequested > itemQuantity
                        ? `Insufficient stock. This cart requests ${totalQuantityRequested} total (including ${itemQuantity} from this seller), only ${availableStock} available`
                        : `Insufficient stock. Requested ${itemQuantity}, only ${availableStock} available`,
                    issueType: 'INSUFFICIENT_STOCK'
                });
            }
        }

        // Validation 3: Check if product is approved and visible
        // isApproved:true is treated as sufficient even when productStatus is still 'pending'
        const isApproved = product.productStatus === 'approved' || product.isApproved === true;
        if (!isApproved || !product.isVisible) {
            for (const item of items) {
                const reasons = [];
                if (!isApproved) reasons.push('not approved');
                if (!product.isVisible) reasons.push('not visible');

                stockIssues.push({
                    productId: item.productId,
                    productName: item.name || product.productName,
                    sellerId: item.sellerId,
                    availableStock: 0,
                    issue: `Product is not available for purchase (${reasons.join(', ')})`,
                    issueType: 'NOT_AVAILABLE',
                    productStatus: product.productStatus,
                    isVisible: product.isVisible
                });
            }
        }
    }

    return stockIssues;
}

/**
 * Helper function to format stock issues for user-friendly error messages
 */
function formatStockIssues(stockIssues) {
    if (stockIssues.length === 0) {
        return null;
    }

    // Group issues by type for better error messaging
    const groupedIssues = {
        notFound: stockIssues.filter(i => i.issueType === 'NOT_FOUND'),
        insufficientStock: stockIssues.filter(i => i.issueType === 'INSUFFICIENT_STOCK'),
        notAvailable: stockIssues.filter(i => i.issueType === 'NOT_AVAILABLE')
    };

    const messages = [];

    if (groupedIssues.notFound.length > 0) {
        messages.push({
            type: 'error',
            title: 'Products Not Found',
            items: groupedIssues.notFound.map(i => ({
                productName: i.productName,
                sellerId: i.sellerId
            }))
        });
    }

    if (groupedIssues.insufficientStock.length > 0) {
        messages.push({
            type: 'warning',
            title: 'Insufficient Stock',
            items: groupedIssues.insufficientStock.map(i => ({
                productName: i.productName,
                requested: i.requestedQuantity,
                available: i.availableStock,
                sellerId: i.sellerId
            }))
        });
    }

    if (groupedIssues.notAvailable.length > 0) {
        messages.push({
            type: 'error',
            title: 'Products Unavailable',
            items: groupedIssues.notAvailable.map(i => ({
                productName: i.productName,
                reason: i.issue,
                sellerId: i.sellerId
            }))
        });
    }

    return {
        hasIssues: true,
        issueCount: stockIssues.length,
        messages
    };
}

function convertNGNtoUSD(priceNGN, fxRate) {
    return priceNGN * fxRate; // returns USD (not cents)
}

module.exports = {
    validateStockAvailability,
    formatStockIssues,
    convertNGNtoUSD
};
