const Bike = require('../models/Bikes');

exports.GetUserBikes = async (req, res) => {
    try {
        const userEmail = req.query.userEmail;
        const bikes = await Bike.find({ owner: userEmail }).sort({ createdAt: -1 });
        const formattedResponse = bikes.map(bike => ({
            bikeName: bike.bikeName,
            manufacturer: bike.manufacturer,
            model: bike.model,
            year: bike.year,
        }));

        res.status(200).json({success: true, bikes: formattedResponse });
    } catch (error) {
        console.error('Error fetching user bikes:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

exports.AddUserBike = async (req, res) => {
    const { bikeName, manufacturer, model, year, userEmail } = req.body;
    try {
        if (!bikeName || !manufacturer || !model || !year) {
            return res.status(400).json({
                success: false,
                message: 'All fields (bikeName, manufacturer, model, year) are required'
            });
        }

        const newBike = new Bike({
            bikeName,
            manufacturer,
            model,
            year,
            owner: userEmail
        });
        await newBike.save();

        res.status(201).json({
            success: true,
            message: 'Bike created successfully',
        });
    } catch (error) {
        console.error('Error creating bike:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating bike',
        });
    }
}
