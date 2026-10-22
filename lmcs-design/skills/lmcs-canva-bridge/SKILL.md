---
name: lmcs-canva-bridge
description: Send an LMCS Design Studio design into the La Montessori School Canva account as an editable design. Use when the user attaches or points to a `.canva.json` package from LMCS Design ("send this to Canva", "put this in Canva", "push to my brand kit"), or asks to move an LMCS Design creative into Canva. Needs the Canva connector.
---

# LMCS Design -> Canva bridge

LMCS Design Studio exports a `*.canva.json` package for each design. The package has:
- the page size,
- every layer, in back-to-front order: native **shapes** (SVG paths in brand hex colours), native **text**
  (fitted font size, colour, weight, alignment), and **images** (the LMS logo by Canva asset ID, plus any flattened
  photos, gradients or QR codes as data URLs).

This skill rebuilds the package as a real, editable Canva design.
Helper script: `scripts/canva_bridge.py` (Python standard library only).

## Steps

1. **Inspect** the package: `python3 scripts/canva_bridge.py info PKG`. Note the page size, `canva.baseDesignId`,
   `canva.folderName` and whether any images need uploading.

2. **Create the working design.** Call `resize-design` on `canva.baseDesignId` with
   `{type: "custom", width: page.width, height: page.height}`. This creates a new design. The original stays untouched.

3. **Open it.** Call `read-design` on the new design with `open_transaction: true` and `filter.fields: ["design_content"]`.
   Save the response to `state0.json`, then note the page `id` and the `transaction_id`.

4. **Upload flattened images** (skip this step if `images_to_upload` is empty):
   - `python3 scripts/canva_bridge.py extract PKG ./canva-images`
   - For each file, call `create-upload-url`, then
     `curl -sS -X POST -H 'Content-Type: application/octet-stream' --data-binary @FILE 'UPLOAD_URL'`.
     The response contains the asset ID. Use each URL exactly once.
   - Write `assets.json`, e.g. `{"img1": "<asset id>", ...}`.

5. **Build the layers:**
   `python3 scripts/canva_bridge.py build PKG --page-id PAGE --state state0.json [--assets assets.json]`.
   This deletes the base design's elements and inserts the shapes, images and text in z-order. Send the list as the
   `operations` of one `edit-design` call (`finalize: "keep_open"`, `page_index: 1`). With more than about 40 ops,
   use `--chunk 30` and send the chunks in order.

6. **Format the text.** Save the `document` from the last `edit-design` response as `state1.json`, then run
   `python3 scripts/canva_bridge.py format PKG state1.json`. Send the resulting `format_text` ops in another
   `edit-design` call (`keep_open`). Then add `{type: "update_title", title: "<package title> (LMCS Design)"}`.

7. **Check and get approval.** Compare the thumbnail with the studio preview, and fix any obvious overflow with
   `resize_element` or `position_element`. **Show the user the preview and wait for an explicit yes**, then call
   `edit-design` with `finalize: "commit"`. If the user says no, call `finalize: "cancel"`.

8. **File it.** Find the folder named `canva.folderName` with `search-folders`, or create it with
   `create-folder` (parent `"root"`), then `move-item-to-folder`. Give the user the design's edit link.

## What carries over, and what to tell the user

- Carries over exactly: layout, panel shapes (including the folder-tab motif), brand hex colours, text sizes, weights,
  alignment, the LMS logo, photos and QR codes.
- **Fonts:** Canva's editing API cannot set a font family, so text arrives in Canva's default font. The package records
  the intended font per layer (`brandFont`). Tell the user to select the text and apply the brand fonts from the Brand
  Kit panel in Canva: Poppins for headings, Open Sans for body.
- **Coloured emphasis words** (`*word*` in the studio) arrive in the layer's single colour. Recolour the word in Canva if needed.
- **Print sizes:** Canva pages are in pixels at 96 px per inch. The package `page.note` says when a page was scaled to
  fit Canva's 8000 px limit. Pass that on. For paper print, turn on File > Show print bleed in Canva before downloading.
- Flattened images (photos, gradients, QR codes) are single image layers in Canva. Swap a photo with Canva's
  replace-image feature.

## Lessons from the first live push

- `add_text` creates 16 px black text in Canva's default font. Formatting must follow in a second call,
  because the locator IDs are only known from the first response.
- `insert_fill` with a Canva asset ID (e.g. the logo `MAE5ocTpgXg`) places the image in a frame of the given box. A
  square logo in a wide box stays square only if the package already fitted the box, which the studio does.
- Shapes that run past the page edge are fine. Canva clips them at the page edge on export.
