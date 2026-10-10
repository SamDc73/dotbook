package dev.dotbook.quicklog

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews

// A static widget: the same bar on every update, the whole of it one tap
// target. Nothing in it changes, so it never asks to be updated
// (updatePeriodMillis 0); Android draws it once when placed.
class ComposeWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val views = RemoteViews(context.packageName, R.layout.quick_log_widget)
    views.setOnClickPendingIntent(android.R.id.background, composePendingIntent(context))
    manager.updateAppWidget(ids, views)
  }
}
