const Bike = require('../models/Bikes');
const { getUserByEmail } = require('../utils/getUserDetailsHelper');
const axios = require('axios');
const { URL } = require('url');

//#region Helpers

async function FetchData(rcNumber) {
    const { data } = await axios.get(process.env.SUPPORTING_VAHAN_BASE_URL, {
        params: { rc_regn_no: rcNumber },
        headers: {
            Accept: 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            Origin: 'https://vahandetails.com',
            Referer: 'https://vahandetails.com/',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        },
        timeout: 10_000
    });

    if (!data?.success) {
        const err = new Error(data?.message || 'Upstream lookup failed');
        err.upstream = data;
        throw err;
    }

    return data;
}

const axiosClient = axios.create({
    timeout: 8000,
    headers: {
        "User-Agent":
            "Motonomaad/1.0 (contact@motonomaad.example; +https://motonomaad.example)",
        Accept: "application/json",
    },
});

// Separate client for scraping HTML (manufacturer pages, automotive sites, DDG results)
const htmlClient = axios.create({
    timeout: 8000,
    headers: {
        "User-Agent":
            "Mozilla/5.0 (Motonomaad/1.0; +https://motonomaad.example)",
        Accept: "text/html",
    },
    maxRedirects: 5,
});

const MANUFACTURER_DOMAINS = {
    "honda": "honda2wheelersindia.com",
    "hero": "heromotocorp.com",
    "bajaj": "bajajauto.com",
    "tvs": "tvsmotor.com",
    "yamaha": "yamaha-motor-india.com",
    "royal enfield": "royalenfield.com",
    "ktm": "ktm.com",
    "suzuki": "suzukimotorcycle.co.in",
    "kawasaki": "kawasaki-india.com",
    "triumph": "triumphmotorcycles.in",
    "harley davidson": "harley-davidson.com",
    "jawa": "jawamotorcycles.com",
    "yezdi": "yezdi.com",
    "mahindra": "mahindra2wheelers.com",
    "classic legends": "yezdi.com", // rc_maker_desc sometimes reports the parent company instead of the brand
};

const AUTOMOTIVE_SITES = [
    { domain: "bikewale.com", label: "BikeWale" },
    { domain: "team-bhp.com", label: "Team-BHP" },
    { domain: "autocarindia.com", label: "Autocar India" },
    { domain: "zigwheels.com", label: "ZigWheels" },
    { domain: "91wheels.com", label: "91Wheels" },
];


function buildImageQuery(rcDetails) {
    const maker = (rcDetails.rc_maker_desc || "")
        .replace(/\([^)]*\)/g, "") // Remove text inside brackets
        .replace(
            /\b(INDIA|LTD|LIMITED|PRIVATE|PVT|COMPANY|CO|MOTORS?|MOTORCYCLE|MOTORCYCLES)\b/gi,
            ""
        )
        .replace(/[-_]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const model = (rcDetails.rc_maker_model || "")
        .replace(
            /\b(BS ?III|BS ?IV|BS ?V|BS ?VI|OBD2|OBD-2|ABS|CBS|FI|EFI|ES|KS|DISC|DRUM|STD|STANDARD|DELUXE)\b/gi,
            ""
        )
        .replace(/\s+/g, " ")
        .trim();

    return { maker, model, combined: `${maker} ${model}`.trim() || null };
}

function resolveUrl(possiblyRelativeUrl, baseUrl) {
    try {
        return new URL(possiblyRelativeUrl, baseUrl).toString();
    } catch {
        return null;
    }
}

function looksLikeLogoOrJunk(url) {
    const lower = url.toLowerCase();
    return (
        /logo|favicon|sprite|icon|placeholder|default[-_]?image/.test(lower) ||
        /\.svg($|\?)/.test(lower)
    );
}

function extractOgImage(html) {
    const patterns = [
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    ];
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return match[1];
    }
    return null;
}

function findManufacturerDomain(maker) {
    const normalized = (maker || "").toLowerCase().trim();
    if (!normalized) return null;
    if (MANUFACTURER_DOMAINS[normalized]) return MANUFACTURER_DOMAINS[normalized];

    for (const [key, domain] of Object.entries(MANUFACTURER_DOMAINS)) {
        if (normalized.includes(key) || key.includes(normalized)) {
            return domain;
        }
    }
    return null;
}

// Extracts a usable, absolute result link from a DuckDuckGo HTML results page
function extractFirstResultUrl(html) {
    const linkPattern = /class="result__a"[^>]+href="([^"]+)"/i;
    const match = html.match(linkPattern);
    if (!match?.[1]) return null;

    let href = match[1];
    const uddgMatch = href.match(/[?&]uddg=([^&]+)/);
    if (uddgMatch) href = decodeURIComponent(uddgMatch[1]);

    return href.startsWith("http") ? href : null;
}

async function findManufacturerPageUrl(model, domain) {
    const { data: html } = await htmlClient.get("https://html.duckduckgo.com/html/", {
        params: { q: `${model} site:${domain}` },
    });
    return extractFirstResultUrl(html);
}

async function fetchManufacturerImage(rcDetails) {
    const { maker, model } = buildImageQuery(rcDetails);
    if (!model) return null;

    const domain = findManufacturerDomain(maker);
    if (!domain) return null;

    try {
        const pageUrl = await findManufacturerPageUrl(model, domain);
        if (!pageUrl) {
            console.log(`[vehicle-image] No manufacturer page found for "${model}" on ${domain}`);
            return null;
        }

        const { data: html } = await htmlClient.get(pageUrl);
        const rawImageUrl = extractOgImage(html);
        if (!rawImageUrl) {
            console.log(`[vehicle-image] No og:image found on ${pageUrl}`);
            return null;
        }

        const imageUrl = resolveUrl(rawImageUrl, pageUrl);
        if (!imageUrl || looksLikeLogoOrJunk(imageUrl)) {
            console.log(`[vehicle-image] Rejected likely logo/junk image: ${imageUrl}`);
            return null;
        }

        return {
            url: imageUrl,
            thumbnail: imageUrl,
            source: `Manufacturer (${domain})`,
            title: model,
            query: `${maker} ${model}`.trim(),
        };
    } catch (err) {
        console.error(`[vehicle-image] manufacturer lookup failed for "${model}" (${domain}):`, err.message);
        return null;
    }
}

async function fetchImageFromAutomotiveSite(query, site) {
    try {
        const pageUrl = await findManufacturerPageUrl(query, site.domain); // same DDG site-search logic
        if (!pageUrl) {
            console.log(`[vehicle-image] No ${site.label} result for "${query}"`);
            return null;
        }

        const { data: html } = await htmlClient.get(pageUrl);
        const rawImageUrl = extractOgImage(html);
        if (!rawImageUrl) {
            console.log(`[vehicle-image] No og:image on ${site.label} page ${pageUrl}`);
            return null;
        }

        const imageUrl = resolveUrl(rawImageUrl, pageUrl);
        if (!imageUrl || looksLikeLogoOrJunk(imageUrl)) {
            console.log(`[vehicle-image] Rejected junk/logo from ${site.label}: ${imageUrl}`);
            return null;
        }

        return {
            url: imageUrl,
            thumbnail: imageUrl,
            source: site.label,
            title: query,
            query,
            sourcePage: pageUrl,
        };
    } catch (err) {
        console.error(`[vehicle-image] ${site.label} lookup failed for "${query}":`, err.message);
        return null;
    }
}

async function fetchImageFromYouTube(query) {
    try {
        const searchQuery = `${query} review OR walkaround OR test ride`;
        const { data: html } = await htmlClient.get("https://html.duckduckgo.com/html/", {
            params: { q: `${searchQuery} site:youtube.com` },
        });

        const href = extractFirstResultUrl(html);
        if (!href) {
            console.log(`[vehicle-image] No YouTube result for "${query}"`);
            return null;
        }

        const videoIdMatch = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
            href.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (!videoIdMatch) {
            console.log(`[vehicle-image] Could not extract video ID from "${href}"`);
            return null;
        }

        const videoId = videoIdMatch[1];
        const maxResUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

        try {
            await axiosClient.head(maxResUrl);
            return {
                url: maxResUrl,
                thumbnail: maxResUrl,
                source: "YouTube",
                title: query,
                query,
                sourcePage: `https://www.youtube.com/watch?v=${videoId}`,
            };
        } catch {
            // maxresdefault.jpg doesn't exist for every video — hqdefault always does
            const hqUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
            return {
                url: hqUrl,
                thumbnail: hqUrl,
                source: "YouTube",
                title: query,
                query,
                sourcePage: `https://www.youtube.com/watch?v=${videoId}`,
            };
        }
    } catch (err) {
        console.error(`[vehicle-image] YouTube lookup failed for "${query}":`, err.message);
        return null;
    }
}

async function fetchImageFromAutomotiveSites(rcDetails) {
    const { combined: query } = buildImageQuery(rcDetails);
    if (!query) return null;

    for (const site of AUTOMOTIVE_SITES) {
        const result = await fetchImageFromAutomotiveSite(query, site);
        if (result) return result;
    }

    return fetchImageFromYouTube(query);
}

async function fetchVehicleImageFromWikipedia(rcDetails) {
    const { model, combined } = buildImageQuery(rcDetails);
    const candidateQueries = [model, combined].filter(Boolean);

    for (const query of candidateQueries) {
        try {
            const { data: searchData } = await axiosClient.get(
                "https://en.wikipedia.org/w/api.php",
                {
                    params: {
                        action: "query",
                        list: "search",
                        srsearch: query,
                        srlimit: 1,
                        format: "json",
                        origin: "*",
                    },
                }
            );

            const page = searchData?.query?.search?.[0];
            if (!page) {
                console.log(`No Wikipedia page found for "${query}"`);
                continue;
            }

            if (/\(company\)|\(manufacturer\)|\(brand\)/i.test(page.title)) {
                console.log(`[vehicle-image] Skipping likely non-vehicle page "${page.title}" for "${query}"`);
                continue;
            }

            const { data: imageData } = await axiosClient.get(
                "https://en.wikipedia.org/w/api.php",
                {
                    params: {
                        action: "query",
                        pageids: page.pageid,
                        prop: "pageimages",
                        piprop: "original",
                        format: "json",
                        origin: "*",
                    },
                }
            );

            const pageInfo = imageData.query.pages[page.pageid];
            const imageUrl = pageInfo?.original?.source;
            if (!imageUrl) {
                console.log(`No image found for "${query}"`);
                continue;
            }

            if (looksLikeLogoOrJunk(imageUrl)) {
                console.log(`[vehicle-image] Rejected likely logo image "${imageUrl}" for "${query}"`);
                continue;
            }

            return {
                url: imageUrl,
                thumbnail: imageUrl,
                source: "Wikipedia",
                title: page.title,
                query,
            };
        } catch (err) {
            console.error(`[vehicle-image] wikipedia lookup failed for "${query}":`, err.message);
            // try next candidate query
        }
    }

    return null;
}

async function fetchVehicleImage(rcDetails) {
    const { combined: query } = buildImageQuery(rcDetails);
    if (!query) return null;

    const manufacturerResult = await fetchManufacturerImage(rcDetails);
    if (manufacturerResult) return manufacturerResult;

    const automotiveResult = await fetchImageFromAutomotiveSites(rcDetails);
    if (automotiveResult) return automotiveResult;

    // Wikipedia kept only as a last-resort fallback
    return fetchVehicleImageFromWikipedia(rcDetails);
}
//#endregion Helpers

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

        const bikes = await Bike.find({ owner: user.userId, bikeStatus: { $ne: 'sold' } }).sort({ createdAt: -1 });
        const formattedResponse = bikes.map(bike => ({
            bikeName: bike.bikeName,
            manufacturer: bike.manufacturer,
            model: bike.model,
            year: bike.year,
            bikeStatus: bike.bikeStatus,
            bikePlate: bike.bikeNumber,
        }));

        res.status(200).json({ success: true, bikes: formattedResponse });
    } catch (error) {
        console.error('Error fetching user bikes:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
}

exports.FetchVehicleDetails = async (req, res) => {
    try {
        const { userEmail, vehiclePlate } = req.query;
        const RC_REGEX = /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$/;
        if (!vehiclePlate) {
            return res.status(400).json({ success: false, message: 'rc_regn_no is required' });
        }
        if (!RC_REGEX.test(vehiclePlate)) {
            return res.status(400).json({ success: false, message: 'Invalid rc_regn_no format' });
        }
        const data = await FetchData(vehiclePlate);
        const vehicleImage = await fetchVehicleImage(data.data.rc_details);
        const BASE_URL = 'http://localhost:3000/'
        if (!vehicleImage || !vehicleImage.url) {
            data.data.vehicle_image = {
                // Files in 'public/' are served from the root
                url: `${BASE_URL}/defaultImage.png`,
                thumbnail: `${BASE_URL}/defaultImage.png`,
                source: "Default",
                title: "Default Bike Image",
                query: "Default"
            };
        } else {
            data.data.vehicle_image = vehicleImage;
        }

        return res.status(200).json({ success: true, data: data, message: 'Vehicle Found' })
    } catch (err) {
        console.error(`[vehicle-search] ${vehiclePlate}:`, err.message);
        return res.status(502).json({
            success: false,
            message: 'Unable to fetch vehicle details right now',
        });
    }
}

exports.AddUserBike = async (req, res) => {
    const { bikeName, manufacturer, model, year, userEmail, bikePlate, kmsDriven } = req.body;
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
            bikeNumber: bikePlate,
            owner: user.userId,
            KmsDriven: kmsDriven
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