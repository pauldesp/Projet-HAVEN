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
      className={`absolute inset-0 w-full h-full object-cover brightness-[0.42] contrast-[1.05] ${imageClassName}`}
    />
    </picture>
    <div className="absolute inset-0 bg-gradient-to-t from-haven-navy/80 via-transparent to-haven-navy/60" />
    <div className="absolute inset-0 bg-black/15 md:bg-black/30" />
  </div>;
}
