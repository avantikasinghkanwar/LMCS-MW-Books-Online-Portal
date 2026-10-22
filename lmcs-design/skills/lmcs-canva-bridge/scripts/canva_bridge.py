#!/usr/bin/env python3
"""Turn an LMCS Design `.canva.json` package into Canva edit-design operations.

Commands
  info    PKG                                  page size, layer counts, notes
  extract PKG OUTDIR                           write image layers to files (for upload)
  build   PKG --page-id ID [--assets MAP] [--state STATE] [--chunk N]
                                               phase 1: delete existing elements (from STATE),
                                               then insert shapes, images and text, in z-order
  format  PKG STATE                            phase 2: format_text ops for the added text,
                                               matched by text content in STATE

MAP   JSON {"img1": "<canva asset id>", ...} from uploading the extracted images
STATE JSON saved from a read-design / edit-design response (design_content or draft page)

Standard library only.
"""
import argparse
import base64
import json
import re
import sys
from pathlib import Path


def load(path):
    return json.loads(Path(path).read_text())


def package(path):
    pkg = load(path)
    if pkg.get("kind") != "canva-package":
        sys.exit("Not an LMCS Design Canva package.")
    return pkg


def norm(text):
    return re.sub(r"\s+", " ", text or "").strip().lower()


def walk_elements(node):
    """Yield every element dict in a read-design / edit-design response."""
    if isinstance(node, dict):
        if "locator_id" in node and "type" in node:
            yield node
        for v in node.values():
            yield from walk_elements(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk_elements(v)


def page_elements(state):
    """Top-level elements of the first page (children of groups are deleted with the group)."""
    for page in walk_pages(state):
        return page.get("elements", [])
    return []


def walk_pages(node):
    if isinstance(node, dict):
        if "elements" in node and ("dimensions" in node or "locator_id" in node):
            yield node
        for v in node.values():
            yield from walk_pages(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk_pages(v)


def element_text(el):
    regions = el.get("textRegions") or []
    return "".join(r.get("characters", "") for r in regions)


def cmd_info(a):
    pkg = package(a.pkg)
    kinds = {}
    for l in pkg["layers"]:
        k = "image (Canva asset)" if l.get("canvaAssetId") else l["kind"]
        kinds[k] = kinds.get(k, 0) + 1
    print(json.dumps({
        "title": pkg["title"], "format": pkg["format"]["name"], "page": pkg["page"],
        "canva": pkg["canva"], "layers": kinds, "images_to_upload": sorted(pkg["images"]),
    }, indent=2))


def cmd_extract(a):
    pkg = package(a.pkg)
    out = Path(a.outdir)
    out.mkdir(parents=True, exist_ok=True)
    files = {}
    for ref, url in pkg["images"].items():
        head, data = url.split(",", 1)
        ext = "jpg" if "jpeg" in head else "png"
        p = out / f"{ref}.{ext}"
        p.write_bytes(base64.b64decode(data))
        files[ref] = str(p)
    print(json.dumps(files, indent=2))


def cmd_build(a):
    pkg = package(a.pkg)
    assets = load(a.assets) if a.assets else {}
    ops = []
    if a.state:
        for el in page_elements(load(a.state)):
            ops.append({"type": "delete_element", "locator_id": el["locator_id"]})
    missing = []
    for l in pkg["layers"]:
        if l["kind"] == "shape":
            op = {
                "type": "insert_shape", "page_id": a.page_id,
                "top": l["top"], "left": l["left"], "width": l["width"], "height": l["height"],
                "path": l["path"], "view_box_width": l["viewBoxWidth"], "view_box_height": l["viewBoxHeight"],
                "color": l["color"],
            }
            for src, dst in (("opacity", "opacity"), ("rotation", "rotation"), ("strokeColor", "stroke_color"), ("strokeWeight", "stroke_weight")):
                if l.get(src) is not None:
                    op[dst] = l[src]
            ops.append(op)
        elif l["kind"] == "image":
            asset = l.get("canvaAssetId") or assets.get(l.get("ref"))
            if not asset:
                missing.append(l.get("ref"))
                continue
            op = {
                "type": "insert_fill", "page_id": a.page_id, "asset_type": "image", "asset_id": asset,
                "alt_text": (l.get("alt") or l.get("role") or "image")[:250],
                "top": l["top"], "left": l["left"], "width": l["width"], "height": l["height"],
            }
            for k in ("opacity", "rotation"):
                if l.get(k) is not None:
                    op[k] = l[k]
            ops.append(op)
        elif l["kind"] == "text":
            op = {"type": "add_text", "page_id": a.page_id, "text": l["text"],
                  "top": l["top"], "left": l["left"], "width": l["width"]}
            for k in ("opacity", "rotation"):
                if l.get(k) is not None:
                    op[k] = l[k]
            ops.append(op)
    if missing:
        print(f"warning: no Canva asset for image layers {missing}; they were skipped", file=sys.stderr)
    if a.chunk:
        chunks = [ops[i:i + a.chunk] for i in range(0, len(ops), a.chunk)]
        print(json.dumps(chunks, indent=1))
    else:
        print(json.dumps(ops, indent=1))


def cmd_format(a):
    pkg = package(a.pkg)
    texts = [el for el in walk_elements(load(a.state)) if el.get("type") == "text"]
    used = set()
    ops, unmatched = [], []
    for l in (x for x in pkg["layers"] if x["kind"] == "text"):
        target = norm(l["text"])
        match = next((el for el in texts if el["locator_id"] not in used and norm(element_text(el)) == target), None)
        if not match:
            unmatched.append(l["text"])
            continue
        used.add(match["locator_id"])
        ops.append({
            "type": "format_text", "locator_id": match["locator_id"],
            "formatting": {
                "font_size": l["fontSize"], "color": l["color"],
                "font_weight": "bold" if l["bold"] else "normal",
                "text_align": l["align"], "line_height": l["lineHeight"],
            },
        })
    if unmatched:
        print(f"warning: text not found in state: {unmatched}", file=sys.stderr)
    print(json.dumps(ops, indent=1))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("info"); p.add_argument("pkg"); p.set_defaults(fn=cmd_info)
    p = sub.add_parser("extract"); p.add_argument("pkg"); p.add_argument("outdir"); p.set_defaults(fn=cmd_extract)
    p = sub.add_parser("build"); p.add_argument("pkg"); p.add_argument("--page-id", required=True)
    p.add_argument("--assets"); p.add_argument("--state"); p.add_argument("--chunk", type=int, default=0)
    p.set_defaults(fn=cmd_build)
    p = sub.add_parser("format"); p.add_argument("pkg"); p.add_argument("state"); p.set_defaults(fn=cmd_format)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
