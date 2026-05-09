# May 2026 Outreach Tracking

Internal campaign tracking conventions for the PermitPulse May 2026 Permit Review Plus outreach sprint.

This document is for repo/internal use. Do not copy it into `dist/` or link it from public pages.

## Campaign

Use one campaign name across all launch outreach:

```text
may_2026_permit_review_plus
```

## UTM Templates

### Personal Gmail

```text
?utm_source=personal_gmail&utm_medium=cold_email&utm_campaign=may_2026_permit_review_plus&utm_content=[audience_or_angle]
```

### PermitPulse Email

```text
?utm_source=permitpulse_email&utm_medium=cold_email&utm_campaign=may_2026_permit_review_plus&utm_content=[audience_or_angle]
```

### Craigslist And Manual Replies

```text
?utm_source=craigslist&utm_medium=reply&utm_campaign=may_2026_permit_review_plus&utm_content=[post_type]
```

### SMS

```text
?utm_source=sms&utm_medium=direct_message&utm_campaign=may_2026_permit_review_plus&utm_content=[audience_or_angle]
```

## Recommended `utm_content` Values

- `adu_builder`
- `remodel_contractor`
- `permit_expeditor`
- `real_estate_agent`
- `investor`
- `red_tape_leaderboard`
- `sample_report`
- `express_review`
- `friday_express_desk`

## Example Links

```text
/preview-pack/?utm_source=personal_gmail&utm_medium=cold_email&utm_campaign=may_2026_permit_review_plus&utm_content=adu_builder
```

```text
/permit-review-plus/?utm_source=permitpulse_email&utm_medium=cold_email&utm_campaign=may_2026_permit_review_plus&utm_content=express_review
```

```text
/red-tape-leaderboard/?utm_source=sms&utm_medium=direct_message&utm_campaign=may_2026_permit_review_plus&utm_content=red_tape_leaderboard
```

## Internal QA Checklist

- Test link opens.
- Confirm GA4 `page_view` has UTM params.
- Confirm CTA click event fires.
- Confirm form hidden fields capture UTM params.
- Confirm Formspree submission includes `landing_page` and `referrer`.

