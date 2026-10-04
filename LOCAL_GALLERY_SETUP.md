# Local gallery proof and delivery

The governed release page now supports local image upload, rights and consent attestation, client proof selection, final access links, and a download request audit. Originals and separate proof previews remain in Postgres `BYTEA`. The local ImageMagick renderer decodes uploaded JPEG, PNG, or WebP files into metadata-stripped 640×480 PNGs with a visible PROOF mark and case/image identifier. No object storage, CDN, email, SMS, or publishing provider is called.

## Provisioning

Apply `backend/migrations/001_governed_photography_release.sql`, then `backend/migrations/003_governed_local_gallery.sql`, then `backend/migrations/004_governed_watermarked_previews.sql` to a database that already has the legacy `clients`, `galleries`, and `shoots` tables. Migration `002_invoice_payment_and_gallery_proofing.sql` is separate and supports the legacy staff selection screen. The app host needs ImageMagick's `magick` executable and a `Helvetica-Bold` font, or configured `PROOF_PREVIEW_BINARY` and `PROOF_PREVIEW_FONT` alternatives. Upload fails closed if a safe preview cannot be rendered. The local renderer uses memory, disk, time, and output-size limits; production still needs image-decoder hardening and resource testing.

The legacy client and gallery tables have no tenant owner column. An operator must bind each client and gallery to the intended tenant before local proofing. For example, after verifying IDs and ownership outside this app:

```sql
INSERT INTO governed_client_bindings (client_id, tenant_id, bound_by)
VALUES (5, 'assigned-tenant', 'operator-id');

INSERT INTO governed_gallery_bindings (gallery_id, client_id, tenant_id, bound_by)
VALUES (4, 5, 'assigned-tenant', 'operator-id');
```

Provision `governed_tenant_memberships` for the photographer, rights reviewer, and studio manager. Use `gallery:4` as the case subject for gallery 4. The gallery must have a client, and uploaded images must be linked to a shoot for that client.

## Workflow

1. Open **Governed photography release**, create/select the gallery case, and upload JPEG, PNG, or WebP images in **Local gallery proof and delivery**. Each upload creates an immutable watermarked preview. For images uploaded before migration 004, use **Render proof preview** in the staff workbench. An image without a safe preview cannot appear under a client link.
2. Record opaque `rights_license` and `consent_release` evidence references in the case. A rights reviewer links both references to each image and records an approval or hold with a reason.
3. A photographer or studio manager creates a proof link and passes it to the client through an approved channel. The link token is shown once, is stored only as a hash on the server, and expires after 14 days. The link holder can view approved images and submit a selection.
4. A studio manager reviews the submitted selection and records a final delivery reason. The final link contains the frozen selection, expires after 30 days, and can be revoked. Its creation does not send a message or prove receipt.
5. Every client preview byte request is audited. Final original downloads record `download_requested` before bytes are sent and `download_stream_finished` when the server finishes writing. Preview requests have their own `preview_requested` and `preview_stream_finished` events. None of these events proves the file reached the client's device.

The client opens `/client-gallery#token=...`. The browser removes the token from its address bar and sends it in the `X-Gallery-Token` header. The token stays in that tab's session storage for reloads. The client sees only rights-approved, watermarked thumbnails under a proof link; the original bytes are available only through final access for the frozen selection. Rights holds and token revocation take effect on subsequent reads. Token possession is not verified client identity, and link creation does not establish external delivery.

The generic render, publish, and export transitions remain disabled until their provider connectors and receipts are configured. Local gallery access is a separate internal delivery path and does not mark an external platform publication.
