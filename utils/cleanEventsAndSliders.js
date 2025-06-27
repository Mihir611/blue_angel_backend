const mongoose = require('mongoose');
const Events = require('../models/Events');

async function updateExpiredEvents() {
    try {
        console.log('Starting cleanup of Events');
        const currentDate = new Date();

        //Getting all the active events
        const result = await Events.updateMany({
            isActive: true,
            eventDate: {$lt: currentDate}
        },{
            $set:{isActive: false}
        });

        console.log(`Successfully updated ${result.modifiedCount} expired events`);
        console.log(`Matched ${result.matchedCount} events that met the criteria`);
        
        return {
            success: true,
            modifiedCount: result.modifiedCount,
            matchedCount: result.matchedCount
        };
    }
    catch (error) {
        console.error('Error updating expired events:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

async function updateExpiredSliders() {
    try {
        console.log('Starting cleanup of sliders');
        const currentDate = new Date();

        const activeSliders = await Sliders.find({isActive: true});
        let expiredSliders = [];

        for(const slider of sctiveSliders) {
            const creationDate = new Date(slider.creationDate);
            const daysDifference = Math.floor((currentDate - creationDate) / (1000 * 60 * 60 * 24));

            if(daysDifference > slider.validTill) {
                expiredSliders.push(slider._id);
                console.log(`  → Marking as expired`);
            }
        }

        let modifiedCount = 0;

        if (expiredSliders.length > 0) {
            // Bulk update expired sliders
            const result = await Sliders.updateMany(
                { _id: { $in: expiredSliders } },
                { $set: { isActive: false } }
            );
            
            modifiedCount = result.modifiedCount;
            console.log(`Successfully updated ${modifiedCount} expired sliders`);
        } else {
            console.log('No expired sliders found');
        }
        
        return {
            success: true,
            totalChecked: activeSliders.length,
            expiredFound: expiredSliders.length,
            modifiedCount: modifiedCount
        };
    } catch (error) {
        console.error('Error updating expired sliders:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    updateExpiredEvents,
    updateExpiredSliders
}