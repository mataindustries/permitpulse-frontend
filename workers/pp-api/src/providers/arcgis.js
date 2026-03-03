// workers/pp-api/src/providers/arcgis.js
export async function arcgisQuery({
  layerBaseUrl,
    outFields = "*",
	  orderByFields,
	    limit = 200,
		  offset = 0,
		    signal,
			}) {
			  if (!layerBaseUrl || !/^https?:\/\//i.test(layerBaseUrl)) {
			      return {
				        ok: false,
						      status: 400,
							        url: String(layerBaseUrl || ""),
									      errorText: "Invalid layerBaseUrl",
										      };
											    }

												  // Ensure we always hit .../FeatureServer/<layer>/query
												    const base = layerBaseUrl.replace(/\/+$/, ""); // strip trailing slash
													  const u = new URL(base + "/query");

													    u.searchParams.set("f", "json");
														  u.searchParams.set("where", "1=1");
														    u.searchParams.set("outFields", outFields);
															  u.searchParams.set("returnGeometry", "false");
															    u.searchParams.set("resultRecordCount", String(limit));
																  u.searchParams.set("resultOffset", String(offset));
																    if (orderByFields) u.searchParams.set("orderByFields", orderByFields);

																	  let res, text;
																	    try {
																		    res = await fetch(u.toString(), { signal });
																			    text = await res.text();
																				  } catch (e) {
																				      return { ok: false, status: 502, url: u.toString(), errorText: String(e?.message || e) };
																					    }

																						  if (!res.ok) return { ok: false, status: res.status, url: u.toString(), errorText: text };

																						    let data;
																							  try {
																							      data = JSON.parse(text);
																								    } catch {
																									    return { ok: false, status: 502, url: u.toString(), errorText: "ArcGIS returned invalid JSON" };
																										  }

																										    if (data?.error) {
																											    return { ok: false, status: 502, url: u.toString(), errorText: JSON.stringify(data.error) };
																												  }

																												    const features = Array.isArray(data.features) ? data.features : [];
																													  return { ok: true, url: u.toString(), features };
																													  }