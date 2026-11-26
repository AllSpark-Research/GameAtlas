# Interactive showcase previews

The project website uses lightweight meshes and WebP textures for interactive viewing. Larger preview meshes are simplified for display. Animation previews retain the archived keyframes and timing. Scores are computed on the original deliveries. The viewer decompresses gzip assets and caches them across carousel switches. Motion bounds were measured over 61 frames from the delivery and reference.

Animation scores match the archived November 13 Sol artifacts, not the latest leaderboard run: Ronin 55.507749; Sniper 24.251987; Titan 58.394248; DRAGO 22.047777.

The colored helmet is a textured identity reference from Khronos glTF Sample Assets, Models/SciFiHelmet (https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SciFiHelmet). See HELMET-LICENSE.md. It is distinct from the untextured task input and the agent UV delivery. Base color and occlusion textures are retained; preview metalness/roughness are approximated.
