const Bike = require('../models/Bikes');
const { getUserByEmail } = require('../utils/getUserDetailsHelper');

exports.GetUserBikes = async (req, res) => {
    try {
        const { userEmail } = req.query;

        if (!userEmail) {
            return res.status(400).json({ success: false, message: 'User email is required' });
        }

        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const bikes = await Bike.find({ owner: user.userId }).sort({ createdAt: -1 });
        const formattedResponse = bikes.map(bike => ({
            bikeName: bike.bikeName,
            manufacturer: bike.manufacturer,
            model: bike.model,
            year: bike.year,
            bikeStatus: bike.bikeStatus
        }));

        res.status(200).json({ success: true, bikes: formattedResponse });
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

        if (!userEmail) {
            return res.status(400).json({ success: false, message: 'User email is required' });
        }

        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const newBike = new Bike({
            bikeName,
            manufacturer,
            model,
            year,
            owner: user.userId
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

exports.UpdateBikeStatus = async (req, res) => {
    const { bikeName, bikeStatus } = req.body;
    const { userEmail } = req.query;
    const validStatuses = ['primary', 'inUse', 'sold', 'inactive', 'underMaintainance']
    try {
        if (!bikeName) {
            return res.status(400).json({ success: false, message: 'Please select a bike to update its status' });
        }

        if (!bikeStatus) {
            return res.status(400).json({ success: false, message: 'Please provide a status to update' });
        }

        if (!validStatuses.includes(bikeStatus)) {
            return res.status(400).json({ success: false, message: `Invalid status. Allowed values are: ${validStatuses.join(', ')}` });
        }

        if (!userEmail) {
            return res.status(400).json({ success: false, message: 'User email is required' });
        }

        const user = await getUserByEmail(userEmail);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const updateBike = await Bike.findOneAndUpdate({ bikeName: bikeName, owner: user.userId }, { bikeStatus: bikeStatus }, { new: true });

        if (!updateBike) {
            return res.status(404).json({ success: false, message: 'Bike not found' });
        }

        return res.status(200).json({ success: true, message: 'Bike Status updated successfully', data: updateBike });
    } catch (err) {
        console.error('Error updating bike:', err);
        res.status(500).json({ success: false, message: 'Error updating bike' });
    }
}