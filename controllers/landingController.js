const Events = require('../models/Events');
const Sliders = require('../models/Sliders');
const ClubRequest = require('../models/ClubJoinRequests');
const { updateExpiredEvents, updateExpiredSliders } = require('../utils/cleanEventsAndSliders');

const getEvents = async () => {
    try {
        let result = await updateExpiredEvents();
        if (result.success) {
            console.log('Script completed successfully');
        } else {
            console.error('Script failed:', result.error);
        }

        const events = await Events.find({ isActive: true })
            .sort({ eventDate: 1 }) // Sort by event date ascending
            .limit(5) // Limit to 10 events
            .select('title description imageUrl eventDate location category price'); // Select only necessary fields
        return events;
    } catch (err) {
        throw new Error('Failed to fetch events: ' + err.message);
    }
}

exports.getLandingPageEvents = async (req, res) => {
    try {
        const [events, sliders] = await Promise.all([getEvents()]);
        res.json({ events, sliders });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Internal server error', error: err.message });
    }
}

exports.clubsJoinRequest = async (req, res) => {
    try {
        const { name, email, number, address, bike, emergencyContact, club, hasApp } = req.body;
        if (!name || !email || !number) {
            return res.status(400).json({ Success: false, message: 'Rider name, email and contact number is required' })
        }

        if (
            !address?.city ||
            !address?.state ||
            !address?.country
        ) {
            return res.status(400).json({
                Success: false,
                message: 'City, state and country are required'
            });
        }

        if (!bike?.make || !bike?.model) {
            return res.status(400).json({
                Success: false,
                message: 'Bike make and model are required'
            });
        }

        if (!emergencyContact?.name || !emergencyContact?.number) {
            return res.status(400).json({
                Success: false,
                message: 'Emergency contact name and number are required'
            });
        }

        if (!club?.name || !club?.clubId) {
            return res.status(400).json({
                Success: false,
                message: 'Club name and club ID are required'
            });
        }

        const userExists = await ClubRequest.findOne({
            riderEmail: email,
            'JoiningClubDetails.clubId': club.clubId
        });

        if (userExists) {
            return res.status(409).json({Success: false, message: `This email already exists in ${club.name}`})
        }

        const result = await ClubRequest.create({
            riderName: name,
            riderEmail: email,
            riderContactNumber: number,
            riderAddress: address,
            bikeDetails: bike,
            emergencyContact: emergencyContact,
            JoiningClubDetails: club,
            hasApplication: hasApp
        })
        res.status(201).json({Success: true, message: `You have successfully request to join ${club.name}`})
    } catch (err) {
        res.status(500).json({ Success: false, message: err.message });
    }
}