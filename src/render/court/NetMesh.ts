import * as THREE from 'three';
import type { CourtSpec } from '@/core/court/courtSpec';
import type { Theme } from '../theme/Theme';

/**
 * The net panel: a translucent fabric running from just above the floor up
 * to a solid white top tape band (the band the net height is measured to),
 * with a darker bottom band along its lower edge — matching how a real
 * competition net is bordered on both edges and hangs the full height, not
 * just a strip near the top.
 *
 * This is a plain semi-transparent panel rather than a textured mesh grid.
 * A real net's weave is only resolvable up close — photographed or viewed
 * from normal distance, it reads as a hazy translucent rectangle, which is
 * also what a repeating grid texture actually renders as here once you
 * account for it being viewed from more than a couple of meters away: fine
 * repeating detail either mipmaps down to invisible or aliases into a
 * moiré shimmer depending on texture filtering, and neither reads as "net".
 * A flat translucent panel sidesteps that class of problem entirely.
 */
export function buildNetGroup(spec: CourtSpec, theme: Theme): THREE.Group {
  const group = new THREE.Group();
  const width = spec.antennaSpanM;
  const bottomBandM = spec.netTopBandM * 0.7;
  const topOfFabric = spec.netHeightM - spec.netTopBandM;
  const fabricHeight = topOfFabric - bottomBandM;

  const fabric = new THREE.Mesh(
    new THREE.PlaneGeometry(width, fabricHeight),
    new THREE.MeshBasicMaterial({
      color: theme.net.meshColor,
      transparent: true,
      opacity: theme.net.opacity,
      side: THREE.DoubleSide,
    }),
  );
  fabric.position.set(0, bottomBandM + fabricHeight / 2, 0);
  group.add(fabric);

  const band = new THREE.Mesh(
    new THREE.PlaneGeometry(width, spec.netTopBandM),
    new THREE.MeshBasicMaterial({ color: theme.net.bandColor, side: THREE.DoubleSide }),
  );
  band.position.set(0, spec.netHeightM - spec.netTopBandM / 2, 0);
  group.add(band);

  const bottomBand = new THREE.Mesh(
    new THREE.PlaneGeometry(width, bottomBandM),
    new THREE.MeshBasicMaterial({ color: theme.net.bottomBandColor, side: THREE.DoubleSide }),
  );
  bottomBand.position.set(0, bottomBandM / 2, 0);
  group.add(bottomBand);

  return group;
}
