export const JURISDICTIONS = [
	{
		id: 'la_city',
		name: 'Los Angeles',
		placeholder: true,
		provider: {
			type: 'socrata',
			domain: 'data.lacity.org',
			dataset: 'pi9x-tg5x',
			fields: {
				id: 'permit_nbr',
				address: 'primary_address',
				status: null,
				permit_type: 'permit_type',
				subtype: 'permit_sub_type',
				filed_at: 'issue_date',
				valuation: 'valuation',
				description: 'work_desc',
			},
			searchFields: ['primary_address', 'permit_nbr', 'work_desc'],
		},
	},
];
