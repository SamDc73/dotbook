package dev.dotbook.quicklog

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri

// What the tile and the widget both do: open Today with the cursor in the
// composer. The app reads `compose` (app/(tabs)/index.jsx); the scheme is
// app.json's. A running app gets it as a new intent, a closed one starts with it.
private const val COMPOSE_URL = "dotbook:///?compose=1"

internal fun composeIntent(context: Context): Intent =
  Intent(Intent.ACTION_VIEW, Uri.parse(COMPOSE_URL))
    .setPackage(context.packageName)
    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

internal fun composePendingIntent(context: Context): PendingIntent =
  PendingIntent.getActivity(
    context,
    0,
    composeIntent(context),
    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
  )
