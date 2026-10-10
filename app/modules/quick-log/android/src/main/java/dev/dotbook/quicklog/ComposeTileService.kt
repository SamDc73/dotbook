package dev.dotbook.quicklog

import android.annotation.SuppressLint
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

// A tile that does one thing, so it has no on/off: it always reads as
// inactive, and a tap closes the shade and opens the composer — after an
// unlock when the phone is locked.
class ComposeTileService : TileService() {
  override fun onStartListening() {
    qsTile?.apply {
      state = Tile.STATE_INACTIVE
      updateTile()
    }
  }

  override fun onClick() {
    if (isLocked) unlockAndRun { open() } else open()
  }

  // Android 14 takes a PendingIntent here and refuses the old Intent form.
  @SuppressLint("StartActivityAndCollapseDeprecated")
  private fun open() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startActivityAndCollapse(composePendingIntent(this))
    } else {
      @Suppress("DEPRECATION")
      startActivityAndCollapse(composeIntent(this))
    }
  }
}
