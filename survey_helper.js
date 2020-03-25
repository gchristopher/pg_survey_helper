// survey_helper.js
// This document is public domain, and no rights are reserved. There is no warranty. Use at your own risk.

// Variables used to calculate on-screen positions.
var map_size_x = 2382;
var map_size_y = 2488;
var map_padding = 20;
var map_left_padding = 15;
var survey_dot_size = 5;
var player_icon_size = [16, 22];
var survey_label_height = 16;
var survey_label_character_width = 10;
var motherlode_label_offset_x = 3;
var motherlode_label_offset_y = -19;

// Constants for supported zones.
var map_sizes = {}
map_sizes["Eltibule"] = [2684, 2778];
map_sizes["Ilmari"] = [2920, 2920];
map_sizes["Kur Mountains"] = [3000, 3000];
map_sizes["Serbule"] = [2382, 2488];
map_sizes["Serbule Hills"] = [2748, 2668];

var map_images = {};
map_images["Eltibule"] = 'eltibule_map.png';
map_images["Ilmari"] = 'ilmari_map.png';
map_images["Kur Mountains"] = 'kur_mountains_map.png';
map_images["Serbule"] = 'serbule_map.png';
map_images["Serbule Hills"] = 'serbule_hills_map.png';


var player_icons = {};
player_icons["Eltibule"] = 'dorf.png';
player_icons["Ilmari"] = 'dorf.png';
player_icons["Kur Mountains"] = 'cold_dorf.png';
player_icons["Serbule"] = 'dorf.png';
player_icons["Serbule Hills"] = 'dorf.png';

// Player position is [0.0 - 1.0] relative to the map edges.
// [0] = Regular survey location, [1] = Motherlode position 1, [2] = Motherlode position 2
var player_position = [[0.5, 0.5], [0.4, 0.5], [0.6, 0.5]];
var survey_count = 0;
var survey_distances = []; // Array of pairs, in meters, relative to the player position. 
var survey_dot_positions = []; // Array of pairs, in pixels, relative to top-left of map.
var survey_dot_label_positions = []; // Array of pairs, in pixels, relative to top-left of map.
var survey_color_toggle = []; // Array of booleans toggling whether a survey is marked as complete.
var survey_renumbering = false;
// Equivalent variables for motherlode surveys
var motherlode_survey_count = 0;
var motherlode_survey_log_counts = [0, 0];
var motherlode_survey_distances = [[], []]; // Two arrays of distances, in meters, relative to the player survey positions. 
var motherlode_survey_dot_locations = []; // Array[2] of pairs, in meters, relative to top-left of map.
var motherlode_survey_dot_positions = []; // Array[2] of pairs, in pixels, relative to top-left of map.
var motherlode_survey_dot_label_positions = []; // Array[2] of pairs, in pixels, relative to top-left of map.
var motherlode_survey_color_toggle = []; // Array of single booleans; toggle the pair of potential survey locations together.

var survey_pin_color_toggle = [ '#FF0000', '#00FFFF' ];
var survey_label_color_toggle = [ '#FF0000', '#00A0A0' ];

// Initialize page when loaded.
$( function() {

  $("#zone_map").resizable({
    aspectRatio: 1/1,
    resize: function() {
      update_survey_pins();
      update_player_icon_position(0, "#player_icon");
      update_player_icon_position(1, "#player_icon_motherlode_1", "#player_icon_motherlode_1_label");
      update_player_icon_position(2, "#player_icon_motherlode_2", "#player_icon_motherlode_2_label");
    },
    start: function() {
      survey_type = $("#survey_type_select").val();
      if(survey_type == "regular") {
        save_player_icon_position(0, "#player_icon");
      } else if(survey_type == "motherlode") {
        save_player_icon_position(1, "#player_icon_motherlode_1");
        save_player_icon_position(2, "#player_icon_motherlode_2");
      }
    },
    stop: function() {
      update_player_icon_containment("#player_icon");
      update_player_icon_containment("#player_icon_motherlode_1");
      update_player_icon_containment("#player_icon_motherlode_2");
      update_survey_pins();
      apply_label_repulsion();
      position_survey_pins();
    }
  });
  $("#zone_map").css({ padding: map_padding + 'px' });
  
  $( "#parse_log" ).on("click", function() {
    parse_logs();
  } );

  $( "#clear_log" ).on("click", function() {
    clear_logs();
  } );
  
  $('[data-toggle="tooltip"]').tooltip();
  
  $("#zone_select").change(function (value) {
    var new_zone = this.value;
    map_size_x = map_sizes[new_zone][0];
    map_size_y = map_sizes[new_zone][1];
    
    $('#zone_map').attr("src", map_images[new_zone]);
    $('#player_icon').attr("src", player_icons[new_zone]);
    $('#player_icon_motherlode_1').attr("src", player_icons[new_zone]);
    $('#player_icon_motherlode_2').attr("src", player_icons[new_zone]);

    update_survey_pins();
  });
  
  // Hidden objects may not have permitted correct pin positioning. 
  // Re-set pin positions when switching to the Map tab.
  $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
    var target = $(e.target).attr("href"); // activated tab
    if(target == "#map") {
      survey_type = $("#survey_type_select").val();
      if(survey_type == "regular") {
        save_player_icon_position(0, "#player_icon");
        update_survey_pins();
        apply_label_repulsion();
        position_survey_pins();
      } else if(survey_type == "motherlode") {
        save_player_icon_position(1, "#player_icon_motherlode_1");
        save_player_icon_position(2, "#player_icon_motherlode_2");
        update_survey_pins();
        position_survey_pins();
      }
    }
  });
  
  $("#player_icon").draggable({ 
    containment: "#zone_map", 
    scroll: false,
    start: function() {
      update_player_icon_containment("#player_icon");
    },
    drag: function() {
      save_player_icon_position(0, "#player_icon");
      update_survey_pins();
    },
    stop: function() {
      save_player_icon_position(0, "#player_icon");
      update_survey_pins();
      apply_label_repulsion();
      position_survey_pins();
    }
  });

  $("#player_icon_motherlode_1").draggable({ 
    containment: "#zone_map", 
    scroll: false,
    start: function() {
      update_player_icon_containment("#player_icon_motherlode_1");
    },
    drag: function() {
      save_player_icon_position(1, "#player_icon_motherlode_1");
      update_player_icon_label_position(1, "#player_icon_motherlode_1_label");
      update_survey_pins();
    },
    stop: function() {
      save_player_icon_position(1, "#player_icon_motherlode_1");
      update_survey_pins();
      position_survey_pins();
    }
  });

  $("#player_icon_motherlode_2").draggable({ 
    containment: "#zone_map", 
    scroll: false,
    start: function() {
      update_player_icon_containment("#player_icon_motherlode_2");
    },
    drag: function() {
      save_player_icon_position(2, "#player_icon_motherlode_2");
      update_player_icon_label_position(2, "#player_icon_motherlode_2_label");
      update_survey_pins();
    },
    stop: function() {
      save_player_icon_position(2, "#player_icon_motherlode_2");
      update_survey_pins();
      position_survey_pins();
    }
  });
  
  update_player_icon_position(0, "#player_icon");
  update_player_icon_position(1, "#player_icon_motherlode_1", "#player_icon_motherlode_1_label");
  update_player_icon_position(2, "#player_icon_motherlode_2", "#player_icon_motherlode_2_label");
  
  $("#survey_type_select").change(function (value) {
    var survey_type = this.value;
    if(survey_type == "regular") {
      toggle_motherlode_survey_elements('hide');
      toggle_regular_survey_elements('show');
    } else if(survey_type == "motherlode") {
      toggle_regular_survey_elements('hide');
      toggle_motherlode_survey_elements('show');
    }
  });
  
  $('#renumberSurveys').change(function() {
    //ggg alert($(this).prop('checked'));
    toggle_survey_renumbering($(this).prop('checked'));
  })
  
  toggle_motherlode_survey_elements('hide');
  toggle_regular_survey_elements('show');
  $("#survey_type_select").val("regular");
} );

function toggle_regular_survey_elements(toggle_mode) {
  if(toggle_mode == 'hide') {
    $("#regular_parse_results").hide();
    $("#player_icon").hide();
    $("#regular_survey_pins").hide();
  } else {
    $("#regular_parse_results").show();
    $("#player_icon").show();
    $("#regular_survey_pins").show();
  }
  $("#regular_survey_input").collapse(toggle_mode);
}

function toggle_motherlode_survey_elements(toggle_mode) {
  if(toggle_mode == 'hide') {
    $("#motherlode_parse_results").hide();
    $("#player_icon_motherlode_1").hide();
    $("#player_icon_motherlode_2").hide();
    $("#player_icon_motherlode_1_label").hide();
    $("#player_icon_motherlode_2_label").hide();
    $("#extra_motherlode_instructions").hide();
    $("#motherlode_survey_pins").hide();
  } else {
    $("#motherlode_parse_results").show();
    $("#player_icon_motherlode_1").show();
    $("#player_icon_motherlode_2").show();
    $("#player_icon_motherlode_1_label").show();
    $("#player_icon_motherlode_2_label").show();
    $("#extra_motherlode_instructions").show();
    $("#motherlode_survey_pins").show();
  }
  $("#motherlode_survey_input").collapse(toggle_mode);
}

function toggle_survey_renumbering(toggle_mode) {
  survey_renumbering = toggle_mode;
  renumber_survey_pins();
}

function clear_logs() {
  survey_type = $("#survey_type_select").val();
  if(survey_type == "regular") {
    $('#chat_log_text_area').val("");
  } else if(survey_type == "motherlode") {
    $('#motherlode_log_area_1').val("");
    $('#motherlode_log_area_2').val("");
  }
}

function parse_logs() {
  survey_type = $("#survey_type_select").val();
  if(survey_type == "regular") {
    parse_regular_logs();
  } else if(survey_type == "motherlode") {
    parse_motherlode_logs();
  }
}

function parse_regular_logs() {
  var lines_to_keep = "";
  var survey_regex_pattern = '\\[Status\\] The (.+) is (\\d+)m (east|west) and (\\d+)m (north|south).';
  var log_lines = $('#chat_log_text_area').val().split('\n');
  survey_count = 0;
  survey_distances = [];
  var resource_counts = {};
  for(var ii = 0; ii < log_lines.length; ii++) {
    var survey_regex = new RegExp(survey_regex_pattern, 'g');
    var match = survey_regex.exec(log_lines[ii])
    if(match) {
      survey_count++;
      if(match.length == 6) {
        var resource = match[1];
        var x_dist = match[2];
        if('west' == match[3]) {
          x_dist = -x_dist;
        }
        var y_dist = match[4];
        if('north' == match[5]) {
          y_dist = -y_dist;
        }
        
        increment_count(resource_counts, resource);
        survey_distances.push([x_dist, y_dist]);
      }
      lines_to_keep = lines_to_keep + log_lines[ii] + '\n';
    }
  }
  $('#regular_parse_results').html(survey_count + ' Surveys Found.');
  var resource_array = Object.keys(resource_counts).map(function(key) {
    return [key, resource_counts[key]];
  });

  resource_array.sort(function(a, b) {
    return a[0].localeCompare(b[0]);
  });
  var resource_report = 'Resources Found:\n';
  for(var ii = 0; ii < resource_array.length; ii++) {
    resource_report = resource_report + resource_array[ii][1] + ': ' + resource_array[ii][0] + '\n';
  }
  $('#chat_log_text_area').val(resource_report + '\n' + lines_to_keep);
  create_survey_points();
  construct_survey_pins();
  save_player_icon_position(0, "#player_icon");
  update_survey_pins();
  apply_label_repulsion();
  position_survey_pins();
};

function parse_motherlode_logs() {
  get_distance_list(0, "#motherlode_log_area_1");
  get_distance_list(1, "#motherlode_log_area_2");
  motherlode_survey_count = Math.min(motherlode_survey_log_counts[0], motherlode_survey_log_counts[1]);
  $("#motherlode_parse_results").html(motherlode_survey_count + " Surveys performed. Position map markers to locate them.");
  create_motherlode_survey_points();
  construct_motherlode_survey_pins();
  save_player_icon_position(1, "#player_icon_motherlode_1");
  save_player_icon_position(2, "#player_icon_motherlode_2");
  update_motherlode_survey_pins();
  //apply_label_repulsion();
  position_survey_pins();
}

function get_distance_list(position_index, input_area_selector) {
  var lines_to_keep = "";
  var motherlode_regex_pattern = '\\[Status\\] The treasure is (\\d+) meters from here';
  var just_a_number_regex = '^(\\d+)$';
  var log_lines = $(input_area_selector).val().split('\n');
  motherlode_survey_log_counts[position_index] = 0;
  motherlode_survey_distances[position_index] = [];
  for(var ii = 0; ii < log_lines.length; ii++) {
    var survey_regex = new RegExp(motherlode_regex_pattern, 'g');
    var number_regex = new RegExp(just_a_number_regex, 'g');
    var match = survey_regex.exec(log_lines[ii]);
    var number_match = number_regex.exec(log_lines[ii]);
    var survey_distance = undefined;
    if(match) {
      survey_distance = match[1];
    }
    if(number_match) {
      survey_distance = number_match[1];
    }
    if(survey_distance) {
      motherlode_survey_log_counts[position_index]++;
      motherlode_survey_distances[position_index].push(survey_distance);
      lines_to_keep = lines_to_keep + survey_distance + '\n';
    }
  }
  $(input_area_selector).val(lines_to_keep);
}

function increment_count(resource_counts, resource) {
  if(resource in resource_counts) {
    resource_counts[resource]++;
  } else {
    resource_counts[resource] = 1;
  }
}

function create_survey_points() {
  var player_x_meters = player_position[0][0] * map_size_x;
  var player_y_meters = player_position[0][1] * map_size_y;
  survey_dot_positions = [];
  survey_dot_label_positions = [];
  survey_color_toggle = [];
  
  for(var ii = 0; ii < survey_count; ii++) {
    survey_x = parseInt(player_x_meters) + parseInt(survey_distances[ii][0]);
    survey_y = parseInt(player_y_meters) + parseInt(survey_distances[ii][1]);
    survey_dot_positions.push([survey_x, survey_y]);
    survey_dot_label_positions.push([survey_x, survey_y]);
    survey_color_toggle.push(false);
  }
}

function calculate_motherlode_possible_positions(player_x_meters, player_y_meters, r0, r1) {
  // From: http://paulbourke.net/geometry/circlesphere/
  // Interpreted at: https://stackoverflow.com/questions/3349125/circle-circle-intersection-points
  var P0_x = player_x_meters[0];
  var P1_x = player_x_meters[1];
  var P0_y = player_y_meters[0];
  var P1_y = player_y_meters[1];
  
  var dx = P1_x - P0_x;
  var dy = P1_y - P0_y;
  var d = Math.sqrt(dx*dx + dy*dy);
  var a = (r0*r0 - r1*r1 + d*d) / (2*d);
  var h = Math.sqrt(r0*r0 - a*a);
  
  var P2_x = P0_x + (P1_x - P0_x) * a / d;
  var P2_y = P0_y + (P1_y - P0_y) * a / d;
  
  var x3a = P2_x + h * (P1_y - P0_y) / d;
  var y3a = P2_y - h * (P1_x - P0_x) / d;
  var position_1 = [x3a, y3a];
  
  var x3b = P2_x - h * (P1_y - P0_y) / d;
  var y3b = P2_y + h * (P1_x - P0_x) / d;
  var position_2 = [x3b, y3b];

  return([position_1, position_2]);
}

function create_motherlode_survey_points() {
  var player_x_meters = [player_position[1][0] * map_size_x, player_position[2][0] * map_size_x];
  var player_y_meters = [player_position[1][1] * map_size_y, player_position[2][1] * map_size_y];
  
  motherlode_survey_dot_locations = [];
  motherlode_survey_dot_positions = [];
  motherlode_survey_dot_label_positions = [];
  survey_color_toggle = [];
  
  for(var ii = 0; ii < motherlode_survey_count; ii++) {
    var possible_positions = calculate_motherlode_possible_positions(player_x_meters, player_y_meters, motherlode_survey_distances[0][ii], motherlode_survey_distances[1][ii]);
    motherlode_survey_dot_locations.push(possible_positions);
    // Effectively dummy values; these will need conversiom from meters to pixels in render step.
    motherlode_survey_dot_positions.push(possible_positions); 
    motherlode_survey_dot_label_positions.push(possible_positions);
    motherlode_survey_color_toggle.push(false);
  }
}

function construct_survey_pins() {
  var survey_pins_html = "";
  for(var ii = 0; ii < survey_count; ii++) {
    survey_pins_html = survey_pins_html + '<span class="survey_dot" id ="survey_dot_' + ii 
      + '" data-index="' + ii + '" style="top: 0px; left: 0px; position: absolute;"></span>' 
      + '<label for="dot_' + ii + '" class="survey_dot_label" id="survey_dot_label_' + ii 
      + '" data-index="' + ii + '" style="top: 0px; left: 0px; position: absolute;">'
      + (ii+1) + '</label>';
  }
  $('#regular_survey_pins').html(survey_pins_html);
  $('.survey_dot').click(function() {
      toggle_pin_color(this);
  });
  $('.survey_dot_label').click(function() {
      toggle_pin_color(this);
  });
}

function renumber_survey_pins() {
  unvisited_survey_count = 0;
  for(var ii = 0; ii < survey_count; ii++) {
    if(survey_renumbering) {
      if(survey_color_toggle[ii]) {
        $('#survey_dot_label_' + ii).html("X");
      } else {
        unvisited_survey_count++;
        $('#survey_dot_label_' + ii).html(unvisited_survey_count);
      }
    } else {
      $('#survey_dot_label_' + ii).html(ii + 1);
    }
  }
}

function construct_motherlode_survey_pins() {
  var survey_pins_html = "";
  for(var ii = 0; ii < motherlode_survey_count; ii++) {
    survey_pins_html = survey_pins_html + '<span class="survey_dot" id ="survey_dot_' + ii 
      + 'a" data-index="' + ii + '" style="top: 0px; left: 0px; position: absolute;"></span>' 
      + '<label for="dot_' + ii + 'a" class="survey_dot_label" id="survey_dot_label_' + ii 
      + 'a" data-index="' + ii + '" style="top: 0px; left: 0px; position: absolute;">'
      + (ii+1) + '</label>';
    survey_pins_html = survey_pins_html + '<span class="survey_dot" id ="survey_dot_' + ii 
      + 'b" data-index="' + ii + '" style="top: 0px; left: 0px; position: absolute;"></span>' 
      + '<label for="dot_' + ii + 'b" class="survey_dot_label" id="survey_dot_label_' + ii 
      + 'b" data-index="' + ii + '" style="top: 0px; left: 0px; position: absolute;">'
      + (ii+1) + '</label>';
  }
  $('#motherlode_survey_pins').html(survey_pins_html);
  $('.survey_dot').click(function() {
      toggle_motherlode_pin_color(this);
  });
  $('.survey_dot_label').click(function() {
      toggle_motherlode_pin_color(this);
  });
}

function toggle_pin_color(pin_object) {
  var this_index = $(pin_object).data("index");
  if(survey_color_toggle[this_index]) {
    survey_color_toggle[this_index] = false;
    $('#survey_dot_' + this_index).css('background-color', survey_pin_color_toggle[0]);
    $('#survey_dot_label_' + this_index).css('color', survey_label_color_toggle[0]);
  } else {
    survey_color_toggle[this_index] = true;
    $('#survey_dot_' + this_index).css('background-color', survey_pin_color_toggle[1]);
    $('#survey_dot_label_' + this_index).css('color', survey_label_color_toggle[1]);
  }
  if(survey_renumbering) {
    renumber_survey_pins();
  }
}

function toggle_motherlode_pin_color(pin_object) {
  var this_index = $(pin_object).data("index");
  if(survey_color_toggle[this_index]) {
    survey_color_toggle[this_index] = false;
    $('#survey_dot_' + this_index + 'a').css('background-color', survey_pin_color_toggle[0]);
    $('#survey_dot_label_' + this_index + 'a').css('color', survey_label_color_toggle[0]);
    $('#survey_dot_' + this_index + 'b').css('background-color', survey_pin_color_toggle[0]);
    $('#survey_dot_label_' + this_index + 'b').css('color', survey_label_color_toggle[0]);
  } else {
    survey_color_toggle[this_index] = true;
    $('#survey_dot_' + this_index + 'a').css('background-color', survey_pin_color_toggle[1]);
    $('#survey_dot_label_' + this_index + 'a').css('color', survey_label_color_toggle[1]);
    $('#survey_dot_' + this_index + 'b').css('background-color', survey_pin_color_toggle[1]);
    $('#survey_dot_label_' + this_index + 'b').css('color', survey_label_color_toggle[1]);
  }
}

function update_regular_survey_pins() {
  var map_image_width = $('#zone_map').width();
  var map_image_height = $('#zone_map').height();
  var player_x_meters = player_position[0][0] * map_size_x + player_icon_size[0]/2;
  var player_y_meters = player_position[0][1] * map_size_y - player_icon_size[1]/2;
  
  for(var ii = 0; ii < survey_count; ii++) {
    survey_dot_positions[ii][0] = parseInt(player_x_meters) + parseInt(survey_distances[ii][0]);
    survey_dot_positions[ii][1] = parseInt(player_y_meters) + parseInt(survey_distances[ii][1]);
    
    if(survey_dot_positions[ii][0] < 0) { survey_dot_positions[ii][0] = 0; };
    if(survey_dot_positions[ii][1] < 0) { survey_dot_positions[ii][1] = 0; };
    
    if(survey_dot_positions[ii][0] > map_size_x) { survey_dot_positions[ii][0] = map_size_x; };
    if(survey_dot_positions[ii][1] > map_size_y) { survey_dot_positions[ii][1] = map_size_y; };
    
    survey_dot_positions[ii][0] = survey_dot_positions[ii][0] / map_size_x * map_image_width + map_padding - survey_dot_size/2 + map_left_padding;
    survey_dot_positions[ii][1] = survey_dot_positions[ii][1] / map_size_y * map_image_height + map_padding - survey_dot_size/2;
    
    survey_dot_label_positions[ii][0] = survey_dot_positions[ii][0] + 8;
    survey_dot_label_positions[ii][1] = survey_dot_positions[ii][1] - 10;
  }
}

function update_motherlode_survey_pins() {
  var map_image_width = $('#zone_map').width();
  var map_image_height = $('#zone_map').height();
  var player_x_meters = [player_position[1][0] * map_size_x, player_position[2][0] * map_size_x];
  var player_y_meters = [player_position[1][1] * map_size_y, player_position[2][1] * map_size_y];
  
  for(var ii = 0; ii < motherlode_survey_count; ii++) {
    var possible_positions = calculate_motherlode_possible_positions(player_x_meters, player_y_meters, motherlode_survey_distances[0][ii], motherlode_survey_distances[1][ii]);
    motherlode_survey_dot_locations[ii] = possible_positions;
    
    motherlode_survey_dot_positions[ii][0][0] = motherlode_survey_dot_locations[ii][0][0] / map_size_x * map_image_width + map_padding - survey_dot_size/2 + map_left_padding;
    motherlode_survey_dot_positions[ii][0][1] = motherlode_survey_dot_locations[ii][0][1] / map_size_y * map_image_height + map_padding - survey_dot_size/2 + map_padding;
    motherlode_survey_dot_positions[ii][1][0] = motherlode_survey_dot_locations[ii][1][0] / map_size_x * map_image_width + map_padding - survey_dot_size/2 + map_left_padding;
    motherlode_survey_dot_positions[ii][1][1] = motherlode_survey_dot_locations[ii][1][1] / map_size_y * map_image_height + map_padding - survey_dot_size/2 + map_padding;

    motherlode_survey_dot_label_positions[ii][0][0] = motherlode_survey_dot_positions[ii][0][0] + 8;
    motherlode_survey_dot_label_positions[ii][0][1] = motherlode_survey_dot_positions[ii][0][1] - 10;
    motherlode_survey_dot_label_positions[ii][1][0] = motherlode_survey_dot_positions[ii][1][0] + 8;
    motherlode_survey_dot_label_positions[ii][1][1] = motherlode_survey_dot_positions[ii][1][1] - 10;
  }
}

function update_survey_pins() {
  if(survey_type == "regular") {
    update_regular_survey_pins();
  } else if(survey_type == "motherlode") {
    update_motherlode_survey_pins();
  }  
  position_survey_pins();
}

//function show_hide_motherlode_pin()

function position_motherlode_survey_pins() {
  var label_suffix = ["a", "b"];
  for(var ii = 0; ii < motherlode_survey_count; ii++) {
    for(var potential_position = 0; potential_position <= 1; potential_position++) {
      var this_label_suffix = label_suffix[potential_position];
      // Distance combinations that result in no intersection (no possible result) will be stored as NaN coordinates.
      if(isNaN(motherlode_survey_dot_locations[ii][potential_position][0]) || isNaN(motherlode_survey_dot_locations[ii][potential_position][1])) {
        $('#survey_dot_' + ii + this_label_suffix).hide();
        $('#survey_dot_label_' + ii + this_label_suffix).hide();
      } else {
        if(   motherlode_survey_dot_locations[ii][potential_position][0] < 0 
           || motherlode_survey_dot_locations[ii][potential_position][1] < 0
           || motherlode_survey_dot_locations[ii][potential_position][0] > map_size_x 
           || motherlode_survey_dot_locations[ii][potential_position][1] > map_size_y) {
          $('#survey_dot_' + ii + this_label_suffix).hide();
          $('#survey_dot_label_' + ii + this_label_suffix).hide();
        } else {
          $('#survey_dot_' + ii+ this_label_suffix).css({ left: motherlode_survey_dot_label_positions[ii][potential_position][0] + 'px', top: motherlode_survey_dot_label_positions[ii][potential_position][1] + 'px' });
          $('#survey_dot_label_' + ii+ this_label_suffix).css({ left: motherlode_survey_dot_label_positions[ii][potential_position][0] + 'px', top: motherlode_survey_dot_label_positions[ii][potential_position][1] + 'px' });
          $('#survey_dot_' + ii + this_label_suffix).show();
          $('#survey_dot_label_' + ii + this_label_suffix).show();
        }
      }
    }
  }
}

function position_survey_pins() {
  if(survey_type == "regular") {
    for(var ii = 0; ii < survey_count; ii++) {
      $('#survey_dot_' + ii).css({ left: survey_dot_positions[ii][0] + 'px', top: survey_dot_positions[ii][1] + 'px' });
      $('#survey_dot_label_' + ii).css({ left: survey_dot_label_positions[ii][0] + 'px', top: survey_dot_label_positions[ii][1] + 'px' });
    }
  } else if(survey_type == "motherlode") {
    position_motherlode_survey_pins();
  }  
}

function save_player_icon_position(icon_index, icon_selector) {
  var map_image_position = $("#zone_map").offset();
  var player_icon_position = $(icon_selector).offset();
  var x_position = player_icon_position.left - map_image_position.left - map_padding;
  var y_position = player_icon_position.top - map_image_position.top - map_padding;
  //var y_position = player_icon_position.top - map_image_position.top;
  player_position[icon_index][0] = x_position / $('#zone_map').width();
  player_position[icon_index][1] = y_position / $('#zone_map').height();
}

function update_player_icon_label_position(icon_index, icon_label) {
  var x_position = player_position[icon_index][0] * $('#zone_map').width() + map_padding + map_left_padding;
  var y_position = player_position[icon_index][1] * $('#zone_map').height() + map_padding;
  $(icon_label).css({ left: (x_position + motherlode_label_offset_x) + 'px', top: (y_position + motherlode_label_offset_y) + 'px' });
}

function update_player_icon_position(icon_index, icon_selector, icon_label) {
  var x_position = player_position[icon_index][0] * $('#zone_map').width() + map_padding + map_left_padding;
  var y_position = player_position[icon_index][1] * $('#zone_map').height() + map_padding;
  //var y_position = -(1.0 - player_position[icon_index][1] ) * $('#zone_map').height() - map_padding - 3.7;
  $(icon_selector).css({ left: x_position + 'px', top: y_position + 'px' });
  if(icon_label) {
    update_player_icon_label_position(icon_index, icon_label);
  }
}

function update_player_icon_containment(icon_selector) {
  var map_image_position = $("#zone_map").offset();
  var containment = [map_image_position.left,
                     map_image_position.top, 
                     map_image_position.left + $('#zone_map').width() + map_padding,
                     map_image_position.top + $('#zone_map').height() + map_padding];
  $(icon_selector).draggable("option", "containment", containment);
  $(icon_selector).data('uiDraggable')._setContainment();
}

function apply_label_repulsion() {
  adjust_survey_label_positions(0.2);
  adjust_survey_label_positions(0.15);
  adjust_survey_label_positions(0.1);
}  

function adjust_survey_label_positions(strength) {
  var label_adjustment_impulse = [];
  for(var ii = 0; ii < survey_count; ii++) {
    label_adjustment_impulse.push(0.0);
  }
  // Calculate label vs. label repulsion
  for(var ii = 0; ii < survey_count - 1; ii++) {
    for(var jj = ii + 1; jj < survey_count; jj++) {
      var impulse = survey_label_repulsion(ii, jj);
      label_adjustment_impulse[ii] += impulse;
      label_adjustment_impulse[jj] -= impulse;
    }
  }
  // Calculate label vs. pin repulsion
  for(var ii = 0; ii < survey_count; ii++) {
    for(var jj = 0; jj < survey_count; jj++) {
      var impulse = survey_label_pin_repulsion(ii, jj);
      label_adjustment_impulse[ii] += impulse;
    }
  }
  for(var ii = 0; ii < survey_count; ii++) {
    if(label_adjustment_impulse[ii] >= 0) {
      label_adjustment_impulse[ii] = Math.min(label_adjustment_impulse[ii], survey_label_height);
    } else {
      label_adjustment_impulse[ii] = Math.max(label_adjustment_impulse[ii], -survey_label_height);
    }
    survey_dot_label_positions[ii][1] += label_adjustment_impulse[ii] * strength;
  }
}

function survey_label_repulsion(survey_index_a, survey_index_b) {
  y_pos_a = survey_dot_label_positions[survey_index_a][1];
  y_pos_b = survey_dot_label_positions[survey_index_b][1];
  y_diff = y_pos_b - y_pos_a;
  if(Math.abs(y_diff) >= survey_label_height) {
    return 0;
  }
  x_pos_a = survey_dot_label_positions[survey_index_a][0];
  x_pos_b = survey_dot_label_positions[survey_index_b][0];
  if((x_pos_b - x_pos_a) >= survey_label_width(survey_index_a)) {
    return 0;
  }
  if((x_pos_a - x_pos_b) >= survey_label_width(survey_index_b)) {
    return 0;
  }
  if(y_pos_a <= y_pos_b) {
    return -survey_label_height - (y_pos_b - y_pos_a);
  }
  return survey_label_height - (y_pos_a - y_pos_b);
}

function survey_label_pin_repulsion(survey_index_a, pin_index_b) {
  y_pos_label = survey_dot_label_positions[survey_index_a][1];
  y_pos_pin = survey_dot_positions[pin_index_b][1];
  if((y_pos_pin - y_pos_label) >= survey_label_height) {
    return 0;
  }
  if((y_pos_label - y_pos_pin) >= survey_dot_size) {
    return 0;
  }
  x_pos_label = survey_dot_label_positions[survey_index_a][0];
  x_pos_pin = survey_dot_positions[pin_index_b][0];
  if((x_pos_pin - x_pos_label) >= survey_label_width(survey_index_a)) {
    return 0;
  }
  if((x_pos_label - x_pos_pin) >= survey_dot_size) {
    return 0;
  }
  y_center_label = y_pos_label + survey_label_height/2;
  y_center_pin = y_pos_pin;
  
  if(y_center_label <= y_center_pin) {
    return -survey_label_height - (y_center_pin - y_center_label);
  }
  return survey_label_height - (y_center_label - y_center_pin);
}

function survey_label_width(survey_index) {
  if(survey_index < 9) { // lables ["1" ... "9"]
    return survey_label_character_width;
  }
  if(survey_index < 99) { // lables ["10" ... "99"]
    return survey_label_character_width * 2;
  }
  // Anyone with >999 surveys is cheating and also a masochist and possibly crazy.
  return survey_label_character_width * 3;
}
  
