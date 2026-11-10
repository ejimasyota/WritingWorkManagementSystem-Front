import type { CharacterImage } from '../types/character';

/** 保存済みの複数画像を復元する。単一画像形式も読み込み、新規画像データは持ち込まない。 */
export function restoreImages(row?: Record<string, unknown>): CharacterImage[] {
  try {
    const parsed = row?.ImgList ? JSON.parse(String(row.ImgList)) : null;
    if (Array.isArray(parsed?.Images)) {
      return parsed.Images.filter((image: CharacterImage) => image?.Path).map((image: CharacterImage) => ({
        Path: String(image.Path), Data: null, Size: 0, Caption: String(image.Caption || ''),
      }));
    }
  } catch { /* 単一画像形式へフォールバックする。 */ }
  return row?.ImgPath ? [{ Path: String(row.ImgPath), Data: null, Size: 0, Caption: '' }] : [];
}

/** 新規画像はデータ、既存画像はパスを送る。配列順が代表画像の順序となる。 */
export function imagePayload(images: CharacterImage[]) {
  return images.map(image => ({ Path: image.Data ? '' : image.Path, Data: image.Data || null, Caption: image.Caption }));
}
