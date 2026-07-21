const SelectedItinerary = require('../models/itinerarySelected');

exports.ExpiryHandelerForItineraries = async () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - process.env.ITINERARY_EXIPRY_TIME);

    const result = await SelectedItinerary.updateMany({
        itineraryStatus: 'Selected',
        createdAt: { $lt: cutoffDate }
    }, {
        $set: {
            itineraryStatus: 'Expired'
        }
    });

    console.log(`${result.modifiedCount} itineraries marked as expired`);
}