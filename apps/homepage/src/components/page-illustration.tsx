export default function PageIllustration() {
  return (
    <svg className="absolute top-0 right-0 transform translate-x-1/2 -mr-16 dark:opacity-40" width="800" height="502" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="400" cy="102" r="400" fill="url(#heroglow_paint0_radial)" fillOpacity=".6" />
      <circle cx="209" cy="289" r="170" fill="url(#heroglow_paint1_radial)" fillOpacity=".4" />
      <defs>
        <radialGradient id="heroglow_paint0_radial" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="rotate(90 149 251) scale(315.089)">
          <stop stopColor="#3ABAB4" />
          <stop offset="1" stopColor="#3ABAB4" stopOpacity=".01" />
        </radialGradient>
        <radialGradient id="heroglow_paint1_radial" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="rotate(90 -40 249) scale(133.913)">
          <stop stopColor="#667EEA" />
          <stop offset="1" stopColor="#667EEA" stopOpacity=".01" />
        </radialGradient>
      </defs>
    </svg>
  )
}