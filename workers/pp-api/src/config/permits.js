export const ALLOWED_ORIGINS = [
	'https://getpermitpulse.com',
	'https://www.getpermitpulse.com',
	// 'https://<your-pages-project>.pages.dev',
];

export const JSON_HEADERS = {
	'content-type': 'application/json; charset=utf-8',
	'cache-control': 'no-store',
};

export const LADBS_SOURCE = {
	dataset: 'pi9x-tg5x',
	domain: 'data.lacity.org',
	filedField: 'issue_date',
	valField: 'valuation',
	permitField: 'permit_nbr',
	zipField: 'zip_code',
	addrField: 'primary_address',
	descField: 'work_desc',
};

export const RADAR_KEYWORDS = {
	roof: ['ROOF', 'REROOF', 'RE-ROOF'],
	solar: ['SOLAR', 'PHOTOVOLTAIC', 'PV'],
	hvac: ['HVAC', 'MECHANICAL', 'A/C', 'AC'],
	general: [],
};

export const STORM_WORDS = [
	'leak',
	'roof leak',
	'water damage',
	'storm',
	'wind damage',
	'emergency',
	'temporary repair',
	'tarp',
	'tarps',
	'dry out',
	'dry-out',
	'repair existing roof',
];
