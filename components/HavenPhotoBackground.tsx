export function HavenPhotoBackground({ imageClassName = '' }: { imageClassName?: string }) {
  return <div className="absolute inset-0 z-0 overflow-hidden">
    {/* AVIF (79 KB instead of 400 KB), a lighter version for phones, JPEG for older browsers. */}
    <picture>
      <source type="image/avif" media="(max-width: 767px)" srcSet="/haven-colocation-contemporaine-900.avif" />
      <source type="image/avif" srcSet="/haven-colocation-contemporaine.avif" />
      <source media="(max-width: 767px)" srcSet="/haven-colocation-contemporaine-900.jpg" />
    <img
      src="/haven-colocation-contemporaine.jpg"
      alt="Salon d’une colocation : jeux vidéo et travail entre colocataires"
      fetchPriority="high"
      className={`absolute inset-0 w-full h-full object-cover brightness-[0.58] contrast-[1.02] saturate-[0.85] ${imageClassName}`}
    />
    </picture>
    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-black/35" />
    <div className="absolute inset-0 bg-black/5 md:bg-black/10" />
  </div>;
}
